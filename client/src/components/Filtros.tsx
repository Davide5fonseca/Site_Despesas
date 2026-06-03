import { Categoria } from "../api/client";
import { formatarMes } from "../lib/format";

interface Props {
  mes: string;
  onMes: (mes: string) => void;
  categorias: Categoria[];
  categoria: number | null;
  onCategoria: (id: number | null) => void;
}

// Navega meses a partir de "YYYY-MM".
function deslocarMes(mes: string, delta: number): string {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(a, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function Filtros({ mes, onMes, categorias, categoria, onCategoria }: Props) {
  return (
    <div className="space-y-3">
      {/* Seletor de mês */}
      <div className="flex items-center justify-between rounded-2xl bg-noite-800/70 p-1.5">
        <button
          onClick={() => onMes(deslocarMes(mes, -1))}
          aria-label="Mês anterior"
          className="rounded-xl p-2.5 text-slate-300 hover:bg-linha/5"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <span className="font-semibold text-slate-100">{formatarMes(mes)}</span>
        <button
          onClick={() => onMes(deslocarMes(mes, 1))}
          aria-label="Mês seguinte"
          className="rounded-xl p-2.5 text-slate-300 hover:bg-linha/5"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Filtro por categoria (chips horizontais) */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sem-scrollbar">
        <Chip ativo={categoria === null} onClick={() => onCategoria(null)} cor="#2bbfa6">
          Todas
        </Chip>
        {categorias.map((c) => (
          <Chip
            key={c.id}
            ativo={categoria === c.id}
            onClick={() => onCategoria(c.id)}
            cor={c.cor}
          >
            {c.nome}
          </Chip>
        ))}
      </div>
    </div>
  );
}

function Chip({
  children,
  ativo,
  onClick,
  cor,
}: {
  children: React.ReactNode;
  ativo: boolean;
  onClick: () => void;
  cor: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
        ativo
          ? "border-transparent bg-marca-500 text-white"
          : "border-linha/10 bg-noite-800/60 text-slate-300 hover:bg-noite-700"
      }`}
    >
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: cor }} />
      {children}
    </button>
  );
}
