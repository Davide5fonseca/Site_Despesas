import { useCallback, useEffect, useState } from "react";
import { api, Categoria, Membro, Resumo as ResumoT } from "../api/client";
import { formatarEuros, formatarMes, mesAtual } from "../lib/format";
import { useAtualizarAuto } from "../lib/useAtualizar";
import { deslocarMes } from "../components/ui/SeletorMes";
import Secao from "../components/ui/Secao";
import NovaDespesa from "../components/NovaDespesa";
import GraficoCategorias from "../components/GraficoCategorias";
import GraficoMensal from "../components/GraficoMensal";

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
  useAtualizarAuto(carregar);

  const nCategorias = resumo?.porCategoria.filter((c) => c.total > 0).length ?? 0;

  return (
    <div className="space-y-5">
      {/* Hero: total do mês com navegação integrada */}
      <section className="relative overflow-hidden rounded-xl2 bg-gradient-to-br from-marca-600 to-marca-800 p-5 text-white shadow-cartao">
        <div
          className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/10"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-16 -left-8 h-40 w-40 rounded-full bg-black/10"
          aria-hidden
        />
        <div className="relative flex items-center justify-between">
          <button
            onClick={() => setMes(deslocarMes(mes, -1))}
            aria-label="Mês anterior"
            className="rounded-xl p-2 text-white/80 transition hover:bg-white/15 active:scale-90"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </button>
          <div className="text-center">
            <p className="text-xs font-medium uppercase tracking-wider text-white/70">
              {formatarMes(mes)}
            </p>
            <p className="mt-0.5 text-[40px] font-extrabold leading-none tracking-tight tabular-nums">
              {resumo ? formatarEuros(resumo.total) : "—"}
            </p>
            <p className="mt-1.5 text-xs text-white/70">
              {resumo && resumo.total > 0
                ? `${nCategorias} ${nCategorias === 1 ? "categoria" : "categorias"}`
                : "Sem despesas este mês"}
            </p>
          </div>
          <button
            onClick={() => setMes(deslocarMes(mes, 1))}
            aria-label="Mês seguinte"
            className="rounded-xl p-2 text-white/80 transition hover:bg-white/15 active:scale-90"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </section>

      {/* Ações */}
      <NovaDespesa categorias={categorias} membros={membros} onGuardado={carregar} variante="destaque" />

      {erro && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {erro}
        </p>
      )}

      {/* Donut por categoria */}
      <Secao titulo="Por categoria" icone={<IconeDonut />}>
        {resumo && <GraficoCategorias dados={resumo.porCategoria} total={resumo.total} />}
      </Secao>

      {/* Total por pessoa */}
      <Secao titulo="Total por pessoa" icone={<IconePessoas />}>
        {resumo && resumo.porPessoa.length && resumo.total > 0 ? (
          <ul className="space-y-3">
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
                      className="h-full rounded-full bg-gradient-to-r from-marca-500 to-marca-300 transition-all"
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
      </Secao>

      {/* Evolução mensal */}
      <Secao titulo="Últimos 6 meses" icone={<IconeBarras />}>
        {resumo && <GraficoMensal dados={resumo.evolucao} mesAtivo={mes} />}
      </Secao>
    </div>
  );
}

function IconeDonut() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2" />
      <path d="M12 4a8 8 0 0 1 8 8" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
function IconePessoas() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.9" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0M16.5 5.4a3 3 0 0 1 0 5.2M17.5 19a5.5 5.5 0 0 0-3-4.9" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}
function IconeBarras() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
