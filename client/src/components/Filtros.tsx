import { Categoria } from "../api/client";
import SeletorMes from "./ui/SeletorMes";

interface Props {
  mes: string;
  onMes: (mes: string) => void;
  categorias: Categoria[];
  categoria: number | null;
  onCategoria: (id: number | null) => void;
}

export default function Filtros({ mes, onMes, categorias, categoria, onCategoria }: Props) {
  return (
    <div className="space-y-3">
      <SeletorMes mes={mes} onMes={onMes} />

      {/* Filtro por categoria (chips horizontais) */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sem-scrollbar">
        <Chip ativo={categoria === null} onClick={() => onCategoria(null)} cor="#2bbfa6">
          Todas
        </Chip>
        {categorias.map((c) => (
          <Chip key={c.id} ativo={categoria === c.id} onClick={() => onCategoria(c.id)} cor={c.cor}>
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
          ? "border-transparent bg-marca-500 text-white shadow-sm shadow-marca-900/30"
          : "border-linha/10 bg-noite-800/60 text-slate-300 hover:bg-noite-700"
      }`}
    >
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: cor }} />
      {children}
    </button>
  );
}
