import { Link } from "react-router-dom";
import type { Categoria, Resumo } from "../api/client";
import { formatarEuros } from "../lib/format";

interface Props {
  orcamentos: Resumo["orcamentos"];
  categorias: Categoria[];
  mesAtual: boolean; // no mês corrente mostra "ritmo" (quanto falta gastar por dia)
}

// Barras de progresso dos orçamentos do mês (total + por categoria).
// Cores: verde até 80%, âmbar até 100%, vermelho quando passa.
export default function BarrasOrcamento({ orcamentos, categorias, mesAtual }: Props) {
  if (!orcamentos.length) {
    return (
      <p className="py-2 text-sm text-slate-500">
        Ainda não definiste orçamentos.{" "}
        <Link to="/definicoes" className="font-semibold text-marcatxt underline">
          Define-os em Definições
        </Link>{" "}
        para veres aqui quanto ainda podes gastar.
      </p>
    );
  }

  const hoje = new Date();
  const diaAtual = hoje.getDate();
  const diasNoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
  const diasRestantes = Math.max(diasNoMes - diaAtual, 0);

  const nomeDe = (id: number | null) =>
    id == null ? "Total do mês" : categorias.find((c) => c.id === id)?.nome ?? "Categoria";
  const corDe = (id: number | null) =>
    id == null ? null : categorias.find((c) => c.id === id)?.cor ?? null;

  const ordenados = [...orcamentos].sort((a, b) => {
    if (a.categoria_id == null) return -1;
    if (b.categoria_id == null) return 1;
    return b.gasto / b.valor_centimos - a.gasto / a.valor_centimos;
  });

  return (
    <ul className="space-y-3">
      {ordenados.map((o) => {
        const pct = o.valor_centimos > 0 ? (o.gasto / o.valor_centimos) * 100 : 0;
        const resta = o.valor_centimos - o.gasto;
        const estado = pct >= 100 ? "passou" : pct >= 80 ? "perto" : "ok";
        const corBarra =
          estado === "passou" ? "bg-red-500" : estado === "perto" ? "bg-amber-400" : "bg-emerald-500";
        const corTexto =
          estado === "passou" ? "text-red-300" : estado === "perto" ? "text-amber-300" : "text-emerald-300";
        const cor = corDe(o.categoria_id);
        const total = o.categoria_id == null;
        return (
          <li key={`${o.categoria_id}`}>
            <div className="mb-1 flex items-center justify-between gap-2 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                {cor && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: cor }} />}
                <span className={`truncate ${total ? "font-semibold text-slate-100" : "text-slate-200"}`}>
                  {nomeDe(o.categoria_id)}
                </span>
              </span>
              <span className="shrink-0 tabular-nums text-slate-400">
                <span className="font-semibold text-slate-100">{formatarEuros(o.gasto)}</span> /{" "}
                {formatarEuros(o.valor_centimos)}
              </span>
            </div>
            <div className={`overflow-hidden rounded-full bg-noite-700 ${total ? "h-3" : "h-2"}`}>
              <div
                className={`h-full rounded-full transition-all ${corBarra}`}
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
            </div>
            <p className={`mt-1 text-xs ${corTexto}`}>
              {estado === "passou"
                ? `Passaste o orçamento em ${formatarEuros(-resta)}`
                : mesAtual && diasRestantes > 0
                ? `Restam ${formatarEuros(resta)} · ${formatarEuros(Math.floor(resta / (diasRestantes + 1)))} por dia até ao fim do mês`
                : `Restam ${formatarEuros(resta)} (${Math.round(pct)}% usado)`}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
