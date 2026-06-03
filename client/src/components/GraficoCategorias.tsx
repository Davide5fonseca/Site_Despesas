import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { Resumo } from "../api/client";
import { formatarEuros } from "../lib/format";

interface Props {
  dados: Resumo["porCategoria"];
  total: number;
}

export default function GraficoCategorias({ dados, total }: Props) {
  if (!dados.length || total === 0) {
    return (
      <p className="py-8 text-center text-sm text-slate-500">
        Sem despesas neste mês. Adiciona a primeira!
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative h-52 w-52">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={dados}
              dataKey="total"
              nameKey="nome"
              cx="50%"
              cy="50%"
              innerRadius={62}
              outerRadius={94}
              paddingAngle={2}
              stroke="none"
            >
              {dados.map((d) => (
                <Cell key={`${d.categoria_id}`} fill={d.cor} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        {/* Total no centro do donut */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs text-slate-400">Total do mês</span>
          <span className="text-xl font-extrabold text-slate-100">{formatarEuros(total)}</span>
        </div>
      </div>

      {/* Legenda com valores e percentagens */}
      <ul className="w-full space-y-2">
        {dados.map((d) => {
          const pct = total > 0 ? Math.round((d.total / total) * 100) : 0;
          return (
            <li key={`${d.categoria_id}`} className="flex items-center gap-3 text-sm">
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: d.cor }} />
              <span className="flex-1 truncate text-slate-200">{d.nome}</span>
              <span className="tabular-nums text-slate-400">{pct}%</span>
              <span className="w-24 text-right font-semibold tabular-nums text-slate-100">
                {formatarEuros(d.total)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
