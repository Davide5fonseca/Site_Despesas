import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { Resumo } from "../api/client";
import { formatarEuros, formatarMesCurto } from "../lib/format";
import { useTema } from "../lib/tema";

interface Props {
  dados: Resumo["evolucao"];
  mesAtivo: string;
}

export default function GraficoMensal({ dados, mesAtivo }: Props) {
  const { tema } = useTema();
  const escuro = tema === "dark";

  const cores = escuro
    ? { eixo: "#94a3b8", inativo: "#1b3b3a", fundo: "#111a2e", borda: "rgba(255,255,255,0.1)", texto: "#e2e8f0" }
    : { eixo: "#64748b", inativo: "#cbd5e1", fundo: "#ffffff", borda: "rgba(15,23,42,0.12)", texto: "#0f172a" };

  const linhas = dados.map((d) => ({
    ...d,
    label: formatarMesCurto(d.mes),
    euros: d.total / 100,
  }));

  const temDados = linhas.some((l) => l.total > 0);
  if (!temDados) {
    return <p className="py-6 text-center text-sm text-slate-500">Ainda sem histórico para mostrar.</p>;
  }

  return (
    <div className="h-44 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={linhas} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
          <XAxis
            dataKey="label"
            tick={{ fill: cores.eixo, fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: escuro ? "rgba(255,255,255,0.04)" : "rgba(15,23,42,0.05)" }}
            contentStyle={{
              background: cores.fundo,
              border: `1px solid ${cores.borda}`,
              borderRadius: 12,
              color: cores.texto,
              boxShadow: "0 10px 30px -12px rgba(0,0,0,0.35)",
            }}
            labelStyle={{ color: cores.eixo }}
            formatter={(v: number) => [formatarEuros(Math.round(v * 100)), "Total"]}
          />
          <Bar dataKey="euros" radius={[6, 6, 0, 0]} maxBarSize={38}>
            {linhas.map((l) => (
              <Cell key={l.mes} fill={l.mes === mesAtivo ? "#2bbfa6" : cores.inativo} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
