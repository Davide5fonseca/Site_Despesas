import { useCallback, useEffect, useState } from "react";
import { api, Categoria, Membro, Resumo as ResumoT } from "../api/client";
import { formatarEuros, formatarMes, mesAtual } from "../lib/format";
import NovaDespesa from "../components/NovaDespesa";
import GraficoCategorias from "../components/GraficoCategorias";
import GraficoMensal from "../components/GraficoMensal";

function deslocarMes(mes: string, delta: number): string {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(a, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function Resumo() {
  const [mes, setMes] = useState(mesAtual());
  const [resumo, setResumo] = useState<ResumoT | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [membros, setMembros] = useState<Membro[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const [r, c, m] = await Promise.all([
        api.resumo(mes),
        api.listarCategorias(),
        api.listarMembros(),
      ]);
      setResumo(r);
      setCategorias(c);
      setMembros(m);
    } catch (e: any) {
      setErro(e?.message || "Falha a carregar dados.");
    }
  }, [mes]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-100">Despesas da Casa</h1>
        <p className="text-sm text-slate-400">Para onde vai o dinheiro, mês a mês.</p>
      </header>

      {/* Seletor de mês */}
      <div className="flex items-center justify-between rounded-2xl bg-noite-800/70 p-1.5">
        <button
          onClick={() => setMes(deslocarMes(mes, -1))}
          aria-label="Mês anterior"
          className="rounded-xl p-2.5 text-slate-300 hover:bg-linha/5"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <span className="font-semibold text-slate-100">{formatarMes(mes)}</span>
        <button
          onClick={() => setMes(deslocarMes(mes, 1))}
          aria-label="Mês seguinte"
          className="rounded-xl p-2.5 text-slate-300 hover:bg-linha/5"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Ações principais */}
      <NovaDespesa categorias={categorias} membros={membros} onGuardado={carregar} variante="destaque" />

      {erro && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {erro}
        </p>
      )}

      {/* Donut por categoria */}
      <section className="cartao p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Por categoria
        </h2>
        {resumo && <GraficoCategorias dados={resumo.porCategoria} total={resumo.total} />}
      </section>

      {/* Total por pessoa */}
      <section className="cartao p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Total por pessoa
        </h2>
        {resumo && resumo.porPessoa.length && resumo.total > 0 ? (
          <ul className="space-y-2">
            {resumo.porPessoa.map((p) => {
              const pct = resumo.total > 0 ? (p.total / resumo.total) * 100 : 0;
              return (
                <li key={`${p.membro_id}`}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-200">{p.nome}</span>
                    <span className="font-semibold tabular-nums text-slate-100">
                      {formatarEuros(p.total)}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-noite-900">
                    <div
                      className="h-full rounded-full bg-marca-400"
                      style={{ width: `${Math.max(pct, 3)}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="py-4 text-center text-sm text-slate-500">Sem despesas neste mês.</p>
        )}
      </section>

      {/* Evolução mensal */}
      <section className="cartao p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Últimos 6 meses
        </h2>
        {resumo && <GraficoMensal dados={resumo.evolucao} mesAtivo={mes} />}
      </section>
    </div>
  );
}
