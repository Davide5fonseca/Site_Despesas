import { useCallback, useEffect, useState } from "react";
import { api, Categoria, Despesa, Membro, Saldos } from "../api/client";
import { formatarEuros, mesAtual } from "../lib/format";
import { useAtualizarAuto } from "../lib/useAtualizar";
import CabecalhoPagina from "../components/ui/CabecalhoPagina";
import SeletorMes from "../components/ui/SeletorMes";
import Secao from "../components/ui/Secao";
import { Skeleton } from "../components/ui/Skeleton";
import ListaMovimentos from "../components/ListaMovimentos";

interface Grupo {
  id: number | null;
  nome: string;
  items: Despesa[];
  total: number;
}

export default function PorPessoa() {
  const [mes, setMes] = useState(mesAtual());
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [membros, setMembros] = useState<Membro[]>([]);
  const [aberto, setAberto] = useState<Record<string, boolean>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [saldos, setSaldos] = useState<Saldos | null>(null);
  const [ambito, setAmbito] = useState<"mes" | "tudo">("mes");
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const [d, c, m, s] = await Promise.all([
        api.listarDespesas({ mes }),
        api.listarCategorias(),
        api.listarMembros(),
        api.saldos(ambito === "mes" ? mes : undefined),
      ]);
      setDespesas(d);
      setCategorias(c);
      setMembros(m);
      setSaldos(s);
    } catch (e: any) {
      setErro(e?.message || "Falha a carregar.");
    } finally {
      setCarregando(false);
    }
  }, [mes, ambito]);

  useEffect(() => {
    carregar();
  }, [carregar]);
  useAtualizarAuto(carregar);

  const grupos: Grupo[] = membros.map((m) => {
    const items = despesas.filter((d) => d.membro_id === m.id);
    return { id: m.id, nome: m.nome, items, total: somar(items) };
  });
  const semPessoa = despesas.filter((d) => d.membro_id == null);
  if (semPessoa.length) {
    grupos.push({ id: null, nome: "Sem pessoa", items: semPessoa, total: somar(semPessoa) });
  }
  grupos.sort((a, b) => b.total - a.total);

  const totalMes = somar(despesas);

  return (
    <div className="palco space-y-4">
      <CabecalhoPagina
        titulo="Pessoas"
        subtitulo="Gastos e contas da casa"
        acao={
          <div className="rounded-2xl bg-noite-800/70 px-4 py-2 text-right">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Total</p>
            <p className="font-bold tabular-nums text-slate-100">{formatarEuros(totalMes)}</p>
          </div>
        }
      />

      <SeletorMes mes={mes} onMes={setMes} />

      {erro && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {erro}
        </p>
      )}

      {carregando && (
        <ul className="space-y-3">
          {[0, 1, 2].map((i) => (
            <li key={i} className="cartao flex items-center gap-3 p-4">
              <Skeleton className="h-11 w-11 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-2 w-full" />
              </div>
            </li>
          ))}
        </ul>
      )}

      {!carregando && membros.length === 0 && (
        <div className="cartao p-8 text-center text-slate-400">
          <p className="text-sm">Ainda não há membros na família.</p>
          <p className="mt-1 text-xs text-slate-500">Adiciona membros em Definições.</p>
        </div>
      )}

      {/* Acertar contas */}
      {saldos && membros.length > 1 && (
        <Secao
          titulo="Acertar contas"
          icone={<IconeTrocas />}
          acao={
            <div className="flex rounded-xl bg-noite-900/60 p-0.5 text-xs">
              {(["mes", "tudo"] as const).map((op) => (
                <button
                  key={op}
                  onClick={() => setAmbito(op)}
                  className={
                    ambito === op
                      ? "rounded-lg bg-marca-500 px-3 py-1 font-semibold text-white"
                      : "px-3 py-1 text-slate-400"
                  }
                >
                  {op === "mes" ? "Mês" : "Tudo"}
                </button>
              ))}
            </div>
          }
        >
          {saldos.despesasContadas === 0 ? (
            <p className="py-1 text-sm text-slate-500">
              Sem despesas divididas {ambito === "mes" ? "neste mês" : "ainda"}. Ao adicionar uma
              despesa, escolhe <span className="text-slate-300">quem pagou</span> e os participantes
              em <span className="text-slate-300">"Dividir por"</span>.
            </p>
          ) : (
            <>
              <ul className="space-y-1.5">
                {saldos.saldos.map((s) => (
                  <li key={s.membro_id} className="flex items-center justify-between text-sm">
                    <span className="text-slate-200">{s.nome}</span>
                    <span
                      className={
                        s.saldo > 0
                          ? "font-semibold text-emerald-300"
                          : s.saldo < 0
                          ? "font-semibold text-red-300"
                          : "text-slate-500"
                      }
                    >
                      {s.saldo > 0
                        ? `recebe ${formatarEuros(s.saldo)}`
                        : s.saldo < 0
                        ? `paga ${formatarEuros(-s.saldo)}`
                        : "saldado"}
                    </span>
                  </li>
                ))}
              </ul>

              {saldos.transferencias.length > 0 ? (
                <div className="mt-4">
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Como acertar
                  </p>
                  <ul className="space-y-2">
                    {saldos.transferencias.map((t, i) => (
                      <li
                        key={i}
                        className="flex items-center gap-2 rounded-xl bg-noite-900/50 px-3 py-2.5 text-sm"
                      >
                        <span className="font-medium text-slate-100">{t.de_nome}</span>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-slate-500">
                          <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span className="font-medium text-slate-100">{t.para_nome}</span>
                        <span className="ml-auto font-bold text-marcatxt">{formatarEuros(t.valor)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="mt-3 text-sm font-medium text-emerald-300">Tudo acertado! 🎉</p>
              )}
            </>
          )}
        </Secao>
      )}

      {/* Um cartão por pessoa */}
      <ul className="space-y-3">
        {grupos.map((g) => {
          const chave = String(g.id);
          const expandido = !!aberto[chave];
          const pct = totalMes > 0 ? (g.total / totalMes) * 100 : 0;
          return (
            <li key={chave} className="cartao overflow-hidden">
              <button
                onClick={() => setAberto((s) => ({ ...s, [chave]: !s[chave] }))}
                className="flex w-full items-center gap-3 p-4 text-left"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-marca-500 to-marca-700 text-base font-bold text-white">
                  {g.nome.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="truncate font-semibold text-slate-100">{g.nome}</p>
                    <span className="font-bold tabular-nums text-slate-100">{formatarEuros(g.total)}</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-noite-900">
                      <div
                        className="h-full rounded-full bg-marca-400"
                        style={{ width: `${Math.max(pct, g.total > 0 ? 4 : 0)}%` }}
                      />
                    </div>
                    <span className="shrink-0 text-xs text-slate-400">
                      {g.items.length} {g.items.length === 1 ? "despesa" : "despesas"}
                    </span>
                  </div>
                </div>
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  className={`shrink-0 text-slate-400 transition ${expandido ? "rotate-180" : ""}`}
                >
                  <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>

              {expandido && (
                <div className="border-t border-linha/10 bg-noite-900/30 p-3">
                  {g.items.length ? (
                    <ListaMovimentos
                      despesas={g.items}
                      categorias={categorias}
                      membros={membros}
                      onAlterado={carregar}
                    />
                  ) : (
                    <p className="py-4 text-center text-sm text-slate-500">Sem despesas neste mês.</p>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function somar(items: Despesa[]): number {
  return items.reduce((s, d) => s + d.valor_centimos, 0);
}

function IconeTrocas() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M4 8h13l-3-3M20 16H7l3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
