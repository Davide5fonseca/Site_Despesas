// Testa a heurística de extração de talões com textos OCR de exemplo.
// Correr: node --import tsx scripts/test-ocr.mts
import { interpretarTexto } from "../src/lib/ocrTalao.ts";

const CATEGORIAS = [
  "Supermercado", "Renda", "Contas/Serviços", "Transportes",
  "Restauração", "Saúde", "Lazer", "Outros",
];

const exemplos: Array<{ nome: string; texto: string; esperado: any }> = [
  {
    nome: "Continente (supermercado)",
    texto: `CONTINENTE MODELO
Rua das Flores 12, Lisboa
NIF 500829993
------------------------------
LEITE MIMOSA      0,89
PAO DE FORMA      1,29
MACAS KG          2,15
------------------------------
SUBTOTAL          4,33
TOTAL A PAGAR     4,33 EUR
IVA INCLUIDO
03/06/2026 14:32
Obrigado pela sua visita`,
    esperado: { valor: 4.33, data: "2026-06-03", categoria: "Supermercado" },
  },
  {
    nome: "Restaurante",
    texto: `Restaurante O Tasco
Mesa 5
2 Bifes           24,00
2 Cafes            2,40
TOTAL             26,40
Data: 01-06-26`,
    esperado: { valor: 26.4, data: "2026-06-01", categoria: "Restauração" },
  },
  {
    nome: "Combustível Galp",
    texto: `GALP ENERGIA
Posto A5 Norte
Gasoleo simples 45,67 L
TOTAL  72,90 EUR
2026.05.28`,
    esperado: { valor: 72.9, data: "2026-05-28", categoria: "Transportes" },
  },
  {
    nome: "Valor com milhares",
    texto: `MOVEIS CASA LDA
Sofa 3 lugares
TOTAL A PAGAR  1.299,99 EUR
15/05/2026`,
    esperado: { valor: 1299.99, data: "2026-05-15", categoria: "Outros" },
  },
];

let falhas = 0;
for (const ex of exemplos) {
  const r = interpretarTexto(ex.texto, CATEGORIAS);
  const okValor = r.valor === ex.esperado.valor;
  const okData = r.data === ex.esperado.data;
  const okCat = r.categoria_sugerida === ex.esperado.categoria;
  if (!okValor || !okData || !okCat) falhas++;
  console.log(
    `${okValor && okData && okCat ? "✓" : "✗"} ${ex.nome}\n` +
      `   valor=${r.valor} (esp ${ex.esperado.valor}) ${okValor ? "ok" : "FALHA"} | ` +
      `data=${r.data} (esp ${ex.esperado.data}) ${okData ? "ok" : "FALHA"} | ` +
      `cat=${r.categoria_sugerida} (esp ${ex.esperado.categoria}) ${okCat ? "ok" : "FALHA"} | ` +
      `loja="${r.loja}" conf=${r.confianca}`
  );
}
console.log(falhas === 0 ? "\nTODOS OK" : `\n${falhas} caso(s) com falha`);
