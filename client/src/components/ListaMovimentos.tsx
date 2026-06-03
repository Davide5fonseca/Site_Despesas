import { useState } from "react";
import { api, Categoria, Despesa, Membro } from "../api/client";
import { formatarEuros, formatarNumero } from "../lib/format";
import Modal from "./Modal";
import FormDespesa, { DadosIniciais } from "./FormDespesa";

interface Props {
  despesas: Despesa[];
  categorias: Categoria[];
  membros: Membro[];
  onAlterado: () => void;
}

function rotuloData(iso: string): string {
  const [a, m, d] = iso.split("-").map(Number);
  const dt = new Date(a, m - 1, d);
  const sem = dt.toLocaleDateString("pt-PT", { weekday: "short" }).replace(".", "");
  const md = dt.toLocaleDateString("pt-PT", { day: "2-digit", month: "short" }).replace(".", "");
  return `${sem.charAt(0).toUpperCase()}${sem.slice(1)}, ${md}`;
}

export default function ListaMovimentos({ despesas, categorias, membros, onAlterado }: Props) {
  const [aEditar, setAEditar] = useState<Despesa | null>(null);
  const [aApagar, setAApagar] = useState<number | null>(null);

  if (!despesas.length) {
    return (
      <div className="cartao flex flex-col items-center p-8 text-center text-slate-400">
        <span className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-noite-900/60 text-slate-500">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </span>
        <p className="text-sm font-medium text-slate-300">Nenhum movimento</p>
        <p className="mt-1 text-xs text-slate-500">Muda o mês ou adiciona uma despesa.</p>
      </div>
    );
  }

  async function apagar(id: number) {
    setAApagar(id);
    try {
      await api.apagarDespesa(id);
      onAlterado();
    } catch (e) {
      console.error(e);
      alert("Não foi possível apagar.");
    } finally {
      setAApagar(null);
    }
  }

  const iniciaisDe = (d: Despesa): DadosIniciais => ({
    id: d.id,
    valorTexto: formatarNumero(d.valor_centimos),
    descricao: d.descricao,
    categoria_id: d.categoria_id,
    membro_id: d.membro_id,
    data: d.data,
    origem: d.origem,
    participantes: d.participantes,
  });

  // Agrupar por dia (a lista já vem ordenada por data desc)
  const grupos: Array<{ data: string; items: Despesa[]; total: number }> = [];
  for (const d of despesas) {
    let g = grupos[grupos.length - 1];
    if (!g || g.data !== d.data) {
      g = { data: d.data, items: [], total: 0 };
      grupos.push(g);
    }
    g.items.push(d);
    g.total += d.valor_centimos;
  }

  return (
    <>
      <div className="space-y-4">
        {grupos.map((g) => (
          <div key={g.data}>
            <div className="mb-1.5 flex items-center justify-between px-1">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                {rotuloData(g.data)}
              </span>
              <span className="text-xs font-semibold tabular-nums text-slate-500">
                {formatarEuros(g.total)}
              </span>
            </div>
            <ul className="overflow-hidden rounded-xl2 border border-linha/5 bg-noite-800/50">
              {g.items.map((d, i) => (
                <li
                  key={d.id}
                  className={`flex items-center gap-3 px-3 py-2.5 ${
                    i > 0 ? "border-t border-linha/5" : ""
                  }`}
                >
                  <button onClick={() => setAEditar(d)} className="flex flex-1 items-center gap-3 text-left">
                    <span
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sm font-bold ring-1 ring-inset ring-linha/10"
                      style={{
                        backgroundColor: (d.categoria_cor ?? "#475569") + "22",
                        color: d.categoria_cor ?? "#94a3b8",
                      }}
                    >
                      {(d.categoria_nome ?? "?").charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-semibold text-slate-100">
                          {d.descricao || d.categoria_nome || "Despesa"}
                        </p>
                        {d.origem === "talao" && (
                          <span
                            title="Registado por foto de talão"
                            className="shrink-0 rounded-md bg-marca-500/15 px-1.5 py-0.5 text-[10px] font-bold text-marcatxt"
                          >
                            IA
                          </span>
                        )}
                      </div>
                      <p className="truncate text-xs text-slate-400">
                        {[d.categoria_nome, d.membro_nome].filter(Boolean).join(" · ") || "Sem categoria"}
                      </p>
                    </div>
                    <span className="shrink-0 font-bold tabular-nums text-slate-100">
                      {formatarEuros(d.valor_centimos)}
                    </span>
                  </button>
                  <button
                    onClick={() => apagar(d.id)}
                    disabled={aApagar === d.id}
                    aria-label="Apagar"
                    className="rounded-lg p-2 text-slate-500 transition hover:bg-red-500/10 hover:text-red-400 disabled:opacity-40"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <Modal titulo="Editar despesa" aberto={aEditar != null} onFechar={() => setAEditar(null)}>
        {aEditar && (
          <FormDespesa
            categorias={categorias}
            membros={membros}
            inicial={iniciaisDe(aEditar)}
            onGuardado={() => {
              setAEditar(null);
              onAlterado();
            }}
            onFechar={() => setAEditar(null)}
          />
        )}
      </Modal>
    </>
  );
}
