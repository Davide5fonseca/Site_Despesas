// Datas "de calendário" no fuso da app (por omissão Europe/Lisbon). O servidor
// corre em UTC no Render: sem isto, na viragem do mês (00:00–01:00 em Lisboa
// no verão) o "mês atual" do servidor seria ainda o anterior.
const FUSO = process.env.APP_TZ || "Europe/Lisbon";

const fmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSO,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Hoje, 'YYYY-MM-DD', no fuso da app. */
export function hoje(): string {
  return fmt.format(new Date());
}

/** Mês atual, 'YYYY-MM', no fuso da app. */
export function mesAtual(): string {
  return hoje().slice(0, 7);
}

/** Desloca um mês 'YYYY-MM' n meses (n pode ser negativo). */
export function deslocarMes(mes: string, n: number): string {
  const [a, m] = mes.split("-").map(Number);
  const total = a * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

/** Os `n` meses que terminam em `mes` (inclusive), do mais antigo para o mais recente. */
export function ultimosMeses(mes: string, n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(deslocarMes(mes, -i));
  return out;
}

export const RE_MES = /^\d{4}-(0[1-9]|1[0-2])$/;

/** 'YYYY-MM-DD' que existe mesmo no calendário (rejeita 2026-02-31). */
export function dataValida(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const [a, mes, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(a, mes - 1, d));
  return dt.getUTCFullYear() === a && dt.getUTCMonth() === mes - 1 && dt.getUTCDate() === d;
}
