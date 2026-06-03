import type { TalaoExtraido } from "../api/client";

// Leitura de talão NO TELEMÓVEL (grátis, sem chave): Tesseract.js reconhece o
// texto da imagem no browser e nós extraímos valor/data/loja por heurística.
// Na 1ª utilização descarrega o modelo de português (precisa de internet uma vez).
export async function lerTalaoLocal(
  imagem: Blob,
  categorias: string[],
  onProgresso?: (p: number) => void
): Promise<TalaoExtraido> {
  // Import dinâmico para não pesar o bundle inicial.
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("por", 1, {
    logger: (m: any) => {
      if (m.status === "recognizing text" && onProgresso) onProgresso(m.progress);
    },
  });
  try {
    const { data } = await worker.recognize(imagem);
    return interpretarTexto(data.text || "", categorias);
  } finally {
    await worker.terminate();
  }
}

// ─────────────────────────── Heurística ───────────────────────────
// Exportada para testes — recebe o texto OCR e devolve os dados extraídos.
export function interpretarTexto(texto: string, categorias: string[]): TalaoExtraido {
  const linhas = texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const { valor, doTotal } = extrairValor(texto, linhas);
  const data = extrairData(texto);
  const loja = extrairLoja(linhas);
  const categoria_sugerida = sugerirCategoria(texto, categorias);

  let confianca: TalaoExtraido["confianca"] = "baixa";
  if (valor !== null && doTotal && data) confianca = "media";
  else if (valor !== null && (doTotal || data)) confianca = "media";

  return { valor, loja, data, categoria_sugerida, confianca };
}

// Converte "1.234,56" / "12,34" / "12.34" / "1 234,56" em número.
function paraNumero(s: string): number | null {
  const t = s.replace(/[^\d.,]/g, "");
  if (!t) return null;
  const dec = Math.max(t.lastIndexOf(","), t.lastIndexOf("."));
  if (dec === -1) {
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }
  const inteiro = t.slice(0, dec).replace(/[.,\s]/g, "");
  const decimal = t.slice(dec + 1).replace(/[^\d]/g, "");
  const n = Number(`${inteiro || "0"}.${decimal}`);
  return Number.isFinite(n) ? n : null;
}

const RE_VALOR = /(\d{1,3}(?:[.\s]\d{3})*|\d+)[.,]\d{2}/g;

function extrairValor(
  texto: string,
  linhas: string[]
): { valor: number | null; doTotal: boolean } {
  // 1) Linha com "total" (mas não subtotal) -> usa o último valor dessa linha.
  const candidatasTotal = linhas.filter(
    (l) => /total|valor a pagar|a pagar|montante/i.test(l) && !/sub\s*total|subtotal/i.test(l)
  );
  for (const linha of candidatasTotal.reverse()) {
    const matches = linha.match(RE_VALOR);
    if (matches && matches.length) {
      const n = paraNumero(matches[matches.length - 1]);
      if (n !== null && n > 0) return { valor: n, doTotal: true };
    }
  }

  // 2) Fallback: o maior valor encontrado no talão.
  let maior: number | null = null;
  const todos = texto.match(RE_VALOR) || [];
  for (const m of todos) {
    const n = paraNumero(m);
    if (n !== null && (maior === null || n > maior)) maior = n;
  }
  return { valor: maior, doTotal: false };
}

function extrairData(texto: string): string | null {
  // DD/MM/AAAA, DD-MM-AA, DD.MM.AAAA
  const m1 = texto.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/);
  if (m1) {
    let [, d, mes, a] = m1;
    let ano = Number(a);
    if (ano < 100) ano += 2000;
    const dd = Number(d);
    const mm = Number(mes);
    if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
      return `${ano}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
    }
  }
  // AAAA-MM-DD
  const m2 = texto.match(/\b(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})\b/);
  if (m2) {
    const [, a, mes, d] = m2;
    const mm = Number(mes);
    const dd = Number(d);
    if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
      return `${a}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
    }
  }
  return null;
}

const PALAVRAS_IGNORAR =
  /fatura|recibo|nif|contribuinte|^iva|c\/iva|s\/iva|total|obrigad|talao|talão|venda|n[º°o]\.?\s|doc\.|caixa|operador|cliente|www\.|http/i;

function extrairLoja(linhas: string[]): string | null {
  // O nome da loja costuma estar no topo. Pega na 1ª linha "de texto" plausível.
  for (const linha of linhas.slice(0, 6)) {
    const letras = (linha.match(/[A-Za-zÀ-ÿ]/g) || []).length;
    const digitos = (linha.match(/\d/g) || []).length;
    if (letras >= 3 && letras >= digitos && !PALAVRAS_IGNORAR.test(linha)) {
      return linha.replace(/\s{2,}/g, " ").slice(0, 40);
    }
  }
  return null;
}

// Palavras-chave -> nome canónico de categoria
const REGRAS: Array<{ re: RegExp; cat: string }> = [
  { re: /continente|pingo\s*doce|lidl|aldi|minipre[çc]o|intermarch|auchan|jumbo|mercadona|super|hiper|mercado|talho|padaria/i, cat: "Supermercado" },
  { re: /restaurante|snack|caf[ée]|pastelaria|tasca|pizz|hamb[uú]rg|burger|mcdonald|kfc|bar\b|churrasc|take\s*away/i, cat: "Restauração" },
  { re: /farm[áa]cia|cl[íi]nica|hospital|m[ée]dic|dent[áa]ria|[óo]tica|analises/i, cat: "Saúde" },
  { re: /galp|bp\b|repsol|cepsa|prio|combust[íi]vel|gas[óo]leo|gasolina|portagem|via\s*verde|cp\b|metro|comboio|t[áa]xi|uber|bolt|estaciona|parque/i, cat: "Transportes" },
  { re: /edp|endesa|iberdrola|galp\s*energia|nos\b|meo\b|vodafone|nowo|[áa]gua|epal|internet|telecom|seguro|renda/i, cat: "Contas/Serviços" },
  { re: /cinema|spotify|netflix|gin[áa]sio|fnac|worten|brinque|jogo|livraria/i, cat: "Lazer" },
];

function sugerirCategoria(texto: string, categorias: string[]): string {
  const existe = (nome: string) =>
    categorias.find((c) => c.toLowerCase() === nome.toLowerCase());

  for (const { re, cat } of REGRAS) {
    if (re.test(texto)) {
      const encontrada = existe(cat);
      if (encontrada) return encontrada;
    }
  }
  return existe("Outros") || categorias[0] || "Outros";
}
