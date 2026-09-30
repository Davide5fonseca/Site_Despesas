import { test } from "node:test";
import assert from "node:assert/strict";
import { interpretarTexto } from "../src/lib/ocrTalao.ts";
import { parseQRFiscal, talaoIdDoQR, mesclarQR } from "../src/lib/qrTalao.ts";
import { enriquecerLoja, reconhecerLoja, reconhecerLojaPorNif } from "../src/lib/lojas.ts";
import { parseEurosParaCentimos, formatarEuros } from "../src/lib/format.ts";

// Correr: npm test (na pasta client). Sem browser — só a lógica pura.

const CATEGORIAS = [
  "Supermercado", "Renda", "Contas/Serviços", "Transportes",
  "Restauração", "Saúde", "Lazer", "Outros",
];

// ── OCR (heurística sobre o texto reconhecido) ──────────────────────────────
const exemplosOCR: Array<{ nome: string; texto: string; valor: number; data: string; categoria: string }> = [
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
    valor: 4.33, data: "2026-06-03", categoria: "Supermercado",
  },
  {
    nome: "Restaurante",
    texto: `Restaurante O Tasco
Mesa 4
2x Prato do dia    18,00
1x Agua            1,40
1x Cafe            0,70
Sobremesa          6,30
TOTAL              26,40
01-06-2026 21:05`,
    valor: 26.4, data: "2026-06-01", categoria: "Restauração",
  },
  {
    nome: "Combustível Galp",
    texto: `GALP ENERGIA
Posto A1 Lisboa
Gasoleo simples 45,12 L
Preco/L 1,616
TOTAL 72,90
28/05/2026`,
    valor: 72.9, data: "2026-05-28", categoria: "Transportes",
  },
  {
    nome: "Valor com milhares",
    texto: `MOVEIS CASA LDA
Sofa 3 lugares
Total 1.299,99
15.05.2026`,
    valor: 1299.99, data: "2026-05-15", categoria: "Outros",
  },
];

for (const ex of exemplosOCR) {
  test(`OCR: ${ex.nome}`, () => {
    const r = interpretarTexto(ex.texto, CATEGORIAS);
    assert.equal(r.valor, ex.valor);
    assert.equal(r.data, ex.data);
    assert.equal(r.categoria_sugerida, ex.categoria);
    assert.ok(r.loja, "deve extrair a loja");
  });
}

test("OCR: texto vazio devolve tudo a null e confiança baixa", () => {
  const r = interpretarTexto("", CATEGORIAS);
  assert.equal(r.valor, null);
  assert.equal(r.data, null);
  assert.equal(r.confianca, "baixa");
});

// ── QR fiscal da AT ─────────────────────────────────────────────────────────
const QR_EXEMPLO =
  "A:502011475*B:999999990*C:PT*D:FS*E:N*F:20260603*G:FS 001/12345*H:JJ4T2K7-12345*I1:PT*I7:10.00*I8:2.30*N:2.30*O:12.30*Q:abcd*R:1234";

test("QR fiscal: extrai NIF, data, total, IVA, ATCUD", () => {
  const qr = parseQRFiscal(QR_EXEMPLO);
  assert.ok(qr);
  assert.equal(qr.nif, "502011475");
  assert.equal(qr.data, "2026-06-03");
  assert.equal(qr.valor, 12.3);
  assert.equal(qr.iva, 2.3);
  assert.equal(qr.atcud, "JJ4T2K7-12345");
  assert.equal(talaoIdDoQR(qr), "JJ4T2K7-12345");
});

test("QR fiscal: sem ATCUD usa NIF:docId como chave; sem NIF não é fiscal", () => {
  const qr = parseQRFiscal("A:500829993*F:20260101*G:FR 1/22*O:5.00");
  assert.equal(talaoIdDoQR(qr), "500829993:FR 1/22");
  assert.equal(parseQRFiscal("https://exemplo.pt/qualquer-coisa"), null);
  assert.equal(parseQRFiscal("A:12*F:20260101*O:5.00"), null);
});

test("QR fiscal: soma IVA por taxa quando falta o campo N", () => {
  const qr = parseQRFiscal("A:500829993*F:20260101*O:20.00*I4:0.60*I6:1.30*I8:2.30");
  assert.equal(qr?.iva, 4.2);
});

test("mesclarQR: o QR manda no valor/data e sobe a confiança", () => {
  const base = { valor: 99, loja: "Loja OCR", data: null, categoria_sugerida: "Outros", confianca: "baixa" as const };
  const r = mesclarQR(base, parseQRFiscal(QR_EXEMPLO)!);
  assert.equal(r.valor, 12.3);
  assert.equal(r.data, "2026-06-03");
  assert.equal(r.loja, "Loja OCR");
  assert.equal(r.confianca, "alta");
  assert.equal(r.talaoId, "JJ4T2K7-12345");
});

// ── Lojas ───────────────────────────────────────────────────────────────────
test("lojas: reconhece por NIF (fiável) antes do nome", () => {
  assert.equal(reconhecerLojaPorNif("502011475")?.nome, "Continente");
  assert.equal(reconhecerLoja("PINGO DOCE DISTRIBUICAO")?.nome, "Pingo Doce");
  assert.equal(reconhecerLoja("Talho do Zé"), null);
  const r = enriquecerLoja({
    valor: 1, loja: "xpto lda", data: null, categoria_sugerida: "Outros", confianca: "baixa", nif: "503340855",
  });
  assert.equal(r.loja, "Lidl");
  assert.equal(r.categoria_sugerida, "Supermercado");
});

// ── Formatação ──────────────────────────────────────────────────────────────
test("euros: vírgula e ponto convertem para cêntimos; inválidos dão null", () => {
  assert.equal(parseEurosParaCentimos("12,50"), 1250);
  assert.equal(parseEurosParaCentimos("12.50"), 1250);
  assert.equal(parseEurosParaCentimos(" 7 "), 700);
  assert.equal(parseEurosParaCentimos("abc"), null);
  assert.equal(parseEurosParaCentimos("-3"), null);
  assert.match(formatarEuros(123456), /1.?234,56/);
});
