import { formatarMes } from "../../lib/format";

export function deslocarMes(mes: string, delta: number): string {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(a, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function SeletorMes({
  mes,
  onMes,
  className = "",
}: {
  mes: string;
  onMes: (mes: string) => void;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center justify-between rounded-2xl border border-linha/10 bg-noite-800/70 p-1 ${className}`}
    >
      <button
        onClick={() => onMes(deslocarMes(mes, -1))}
        aria-label="Mês anterior"
        className="rounded-xl p-2.5 text-slate-300 transition hover:bg-linha/5 active:scale-90"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
      <span className="font-semibold text-slate-100">{formatarMes(mes)}</span>
      <button
        onClick={() => onMes(deslocarMes(mes, 1))}
        aria-label="Mês seguinte"
        className="rounded-xl p-2.5 text-slate-300 transition hover:bg-linha/5 active:scale-90"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
