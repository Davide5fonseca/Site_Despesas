import { useCallback, useEffect, useState } from "react";
import { api, getFamilia, Resumo as ResumoT } from "../api/client";
import { formatarEuros, mesAtual } from "../lib/format";
import { useAtualizarAuto } from "../lib/useAtualizar";
import { useGrupo } from "../lib/grupo";
import { exportarMesPDF } from "../lib/exportarPDF";
import CabecalhoPagina from "../components/ui/CabecalhoPagina";
import SeletorMes from "../components/ui/SeletorMes";
import Secao from "../components/ui/Secao";
import { Skeleton } from "../components/ui/Skeleton";
import GraficoCategorias from "../components/GraficoCategorias";
import GraficoMensal from "../components/GraficoMensal";

export default function Resumo() {
  const { solo } = useGrupo();
  const [mes, setMes] = useState(mesAtual());
  const [resumo, setResumo] = useState<ResumoT | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [exportando, setExportando] = useState(false);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      setResumo(await api.resumo(mes));
    } catch (e: any) {
      setErro(e?.message || "Falha a carregar dados.");
    }
  }, [mes]);

  useEffect(() => {
    carregar();
  }, [carregar]);
  useAtualizarAuto(carregar);

  async function exportar() {
    setErro(null);
    setExportando(true);
    try {
      const despesas = await api.listarDespesas({ mes });
      if (despesas.length === 0) {
        setErro("Não há despesas neste mês para exportar.");
        return;
      }
      await exportarMesPDF({
        mes,
        nomeGrupo: getFamilia()?.nome ?? "ScanWise",
        despesas,
        solo,
      });
    } catch (e: any) {
      setErro(e?.message || "Não foi possível gerar o PDF.");
    } finally {
      setExportando(false);
    }
  }

  return (
    <div className="palco space-y-4">
      <CabecalhoPagina
        titulo="Resumo"
        subtitulo="Para onde vai o dinheiro"
        acao={
          <div className="rounded-2xl bg-noite-800 px-4 py-2 text-right shadow-cartao">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Total</p>
            <p className="font-bold tabular-nums text-slate-100">
              {resumo ? formatarEuros(resumo.total) : "—"}
            </p>
          </div>
        }
      />

      <SeletorMes mes={mes} onMes={setMes} />

      {/* Exportar relatório do mês em PDF */}
      <button
        className="botao-secundario w-full"
        onClick={exportar}
        disabled={exportando || !resumo}
      >
        {exportando ? (
          "A gerar PDF…"
        ) : (
          <>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Exportar PDF do mês
          </>
        )}
      </button>

      {erro && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {erro}
        </p>
      )}

      {/* Donut por categoria */}
      <Secao titulo="Por categoria" icone={<IconeDonut />}>
        {resumo ? (
          <GraficoCategorias dados={resumo.porCategoria} total={resumo.total} />
        ) : (
          <div className="flex flex-col items-center gap-4">
            <Skeleton className="h-52 w-52 rounded-full" />
            <div className="w-full space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-4 w-full" />
              ))}
            </div>
          </div>
        )}
      </Secao>

      {/* Total por pessoa — só em grupo (mais do que uma pessoa) */}
      {!solo && (
        <Secao titulo="Total por pessoa" icone={<IconePessoas />}>
          {!resumo ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-7 w-full" />
              ))}
            </div>
          ) : resumo.porPessoa.length && resumo.total > 0 ? (
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
                    <div className="h-2 overflow-hidden rounded-full bg-noite-700">
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
      )}

      {/* Evolução mensal */}
      <Secao titulo="Últimos 6 meses" icone={<IconeBarras />}>
        {resumo ? (
          <GraficoMensal dados={resumo.evolucao} mesAtivo={mes} />
        ) : (
          <div className="flex h-44 items-end justify-between gap-2">
            {[40, 70, 30, 90, 55, 75].map((h, i) => (
              <Skeleton key={i} className="flex-1 rounded-t-md" style={{ height: `${h}%` }} />
            ))}
          </div>
        )}
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
