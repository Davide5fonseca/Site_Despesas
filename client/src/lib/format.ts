// Formatação portuguesa (pt-PT): euros com vírgula decimal, datas DD/MM/AAAA.

const euros = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
});

/** Cêntimos (inteiro) -> "1.234,56 €" */
export function formatarEuros(centimos: number): string {
  return euros.format(centimos / 100);
}

/** Cêntimos -> "1.234,56" (sem símbolo) */
export function formatarNumero(centimos: number): string {
  return new Intl.NumberFormat("pt-PT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(centimos / 100);
}

/**
 * Converte texto do utilizador ("12,50" ou "12.50") em cêntimos.
 * Devolve null se inválido.
 */
export function parseEurosParaCentimos(texto: string): number | null {
  const limpo = texto.trim().replace(/\s/g, "").replace(",", ".");
  if (limpo === "") return null;
  const n = Number(limpo);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

/** Euros (number, ex.: 12.5) -> cêntimos */
export function eurosParaCentimos(euros: number): number {
  return Math.round(euros * 100);
}

/** "2026-06-03" -> "03/06/2026" */
export function formatarData(iso: string): string {
  const [a, m, d] = iso.split("-");
  if (!a || !m || !d) return iso;
  return `${d}/${m}/${a}`;
}

/** "2026-06" -> "Junho 2026" */
export function formatarMes(mes: string): string {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(a, m - 1, 1);
  const nome = d.toLocaleDateString("pt-PT", { month: "long" });
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} ${a}`;
}

/** "2026-06" -> "Jun" (curto, para eixos de gráfico) */
export function formatarMesCurto(mes: string): string {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(a, m - 1, 1);
  const nome = d.toLocaleDateString("pt-PT", { month: "short" }).replace(".", "");
  return nome.charAt(0).toUpperCase() + nome.slice(1);
}

/** Mês atual no formato "YYYY-MM" */
export function mesAtual(): string {
  const agora = new Date();
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}`;
}

/** Data de hoje no formato "YYYY-MM-DD" */
export function hojeISO(): string {
  const agora = new Date();
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-${String(
    agora.getDate()
  ).padStart(2, "0")}`;
}
