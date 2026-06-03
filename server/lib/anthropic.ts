import Anthropic from "@anthropic-ai/sdk";

// O modelo com visão. Sonnet 4.6 é o Sonnet mais recente: tem visão, é rápido e
// bem mais barato que o Opus para OCR de talões. Configurável por ambiente.
const MODELO = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

// A chave vive SÓ no servidor (.env). Nunca exposta ao frontend.
function obterCliente(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw Object.assign(new Error("ANTHROPIC_API_KEY em falta no servidor (.env)"), {
      codigo: "SEM_CHAVE",
    });
  }
  return new Anthropic({ apiKey });
}

export interface TalaoExtraido {
  valor: number | null; // total em euros, ponto decimal
  loja: string | null;
  data: string | null; // 'YYYY-MM-DD'
  categoria_sugerida: string;
  confianca: "alta" | "media" | "baixa";
}

// Remove cercas de código (``` ou ```json) e devolve o JSON encontrado.
function extrairJson(texto: string): string {
  let t = texto.trim();
  // Remove blocos ```json ... ``` ou ``` ... ```
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  // Caso venha texto à volta, isola o primeiro objeto { ... }
  const inicio = t.indexOf("{");
  const fim = t.lastIndexOf("}");
  if (inicio !== -1 && fim !== -1 && fim > inicio) {
    t = t.slice(inicio, fim + 1);
  }
  return t;
}

function normalizarConfianca(v: unknown): "alta" | "media" | "baixa" {
  return v === "alta" || v === "media" || v === "baixa" ? v : "baixa";
}

// Garante 'YYYY-MM-DD' válido; caso contrário null.
function normalizarData(v: unknown): string | null {
  if (typeof v !== "string") return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(v.trim()) ? v.trim() : null;
}

function normalizarValor(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v) && v >= 0) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(",", ".").replace(/[^\d.]/g, ""));
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return null;
}

/**
 * Lê um talão a partir de uma imagem (base64) e devolve dados estruturados.
 * NÃO grava nada — apenas extrai para pré-preencher o formulário no cliente.
 */
export async function lerTalao(
  imagemBase64: string,
  mediaType: string,
  categorias: string[]
): Promise<TalaoExtraido> {
  const cliente = obterCliente();

  const tiposAceites = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  const tipo = tiposAceites.includes(mediaType) ? mediaType : "image/jpeg";

  const listaCategorias = categorias.length ? categorias.join(", ") : "Outros";

  const sistema =
    "És um extrator de dados de talões/faturas de compras portugueses. " +
    "Respondes SEMPRE e APENAS com um objeto JSON válido, sem texto à volta, " +
    "sem explicações e sem cercas de código.";

  const instrucao = `Analisa a imagem deste talão/fatura e extrai os dados.

Devolve EXATAMENTE este formato JSON (e nada mais):
{
  "valor": number | null,          // TOTAL pago em euros, com ponto decimal (ex.: 12.50). null se ilegível.
  "loja": string | null,           // nome do estabelecimento/loja. null se ilegível.
  "data": "YYYY-MM-DD" | null,      // data da compra. null se ilegível.
  "categoria_sugerida": string,    // UMA destas categorias existentes: ${listaCategorias}
  "confianca": "alta" | "media" | "baixa"
}

Regras:
- Usa o TOTAL final do talão (não subtotais nem IVA isolado).
- A "categoria_sugerida" TEM de ser uma das categorias listadas acima.
- Se a imagem não for um talão ou estiver ilegível, devolve valor/loja/data a null e "confianca": "baixa".
- Datas em formatos PT (DD/MM/AAAA, DD-MM-AAAA) devem ser convertidas para YYYY-MM-DD.`;

  const resposta = await cliente.messages.create({
    model: MODELO,
    max_tokens: 1024,
    system: [{ type: "text", text: sistema, cache_control: { type: "ephemeral" } }],
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: tipo as any, data: imagemBase64 },
          },
          { type: "text", text: instrucao },
        ],
      },
    ],
  });

  const texto = resposta.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  // Parsing seguro: remove fences, isola o objeto e valida campos.
  let bruto: any;
  try {
    bruto = JSON.parse(extrairJson(texto));
  } catch {
    // Modelo não devolveu JSON utilizável -> trata como ilegível.
    return {
      valor: null,
      loja: null,
      data: null,
      categoria_sugerida: "Outros",
      confianca: "baixa",
    };
  }

  // Garante que a categoria sugerida existe na lista (senão "Outros").
  let categoria = typeof bruto.categoria_sugerida === "string" ? bruto.categoria_sugerida : "Outros";
  if (!categorias.some((c) => c.toLowerCase() === String(categoria).toLowerCase())) {
    categoria = categorias.includes("Outros") ? "Outros" : categorias[0] || "Outros";
  }

  return {
    valor: normalizarValor(bruto.valor),
    loja: typeof bruto.loja === "string" && bruto.loja.trim() ? bruto.loja.trim() : null,
    data: normalizarData(bruto.data),
    categoria_sugerida: categoria,
    confianca: normalizarConfianca(bruto.confianca),
  };
}
