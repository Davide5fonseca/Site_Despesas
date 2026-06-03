import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import { Resumo } from "../api/client";
import { formatarEuros, formatarMesCurto } from "../lib/format";

interface Props {
  dados: Resumo["evolucao"];
  mesAtivo: string;
}

export default function GraficoMensal({ dados, mesAtivo }: Props) {
  const linhas = dados.map((d) => ({
    ...d,
    label: formatarMesCurto(d.mes),
    euros: d.total / 100,
  }));

  const temDados = linhas.some((l) => l.total > 0);
  if (!temDados) {
    return (
      <p className="py-6 text-center text-sm text-slate-500">
        Ainda sem histórico para mostrar.
      </p>
    );
  }

  return (
    <div className="h-44 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={linhas} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
          <XAxis
            dataKey="label"
            tick={{ fill: "#94a3b8", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
            contentStyle={{
              background: "#111a2e",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 12,
              color: "#e2e8f0",
            }}
            labelStyle={{ color: "#94a3b8" }}
            formatter={(v: number) => [formatarEuros(Math.round(v * 100)), "Total"]}
          />
          <Bar dataKey="euros" radius={[6, 6, 0, 0]} maxBarSize={38}>
            {linhas.map((l) => (
              <Cell key={l.mes} fill={l.mes === mesAtivo ? "#2bbfa6" : "#1b3b3a"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
