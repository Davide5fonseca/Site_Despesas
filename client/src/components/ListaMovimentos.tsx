import { useState } from "react";
import { api, Categoria, Despesa, Membro } from "../api/client";
import { formatarData, formatarEuros, formatarNumero } from "../lib/format";
import Modal from "./Modal";
import FormDespesa, { DadosIniciais } from "./FormDespesa";

interface Props {
  despesas: Despesa[];
  categorias: Categoria[];
  membros: Membro[];
  onAlterado: () => void;
}

export default function ListaMovimentos({ despesas, categorias, membros, onAlterado }: Props) {
  const [aEditar, setAEditar] = useState<Despesa | null>(null);
  const [aApagar, setAApagar] = useState<number | null>(null);

  if (!despesas.length) {
    return (
      <div className="cartao p-8 text-center text-slate-400">
        <p className="text-sm">Nenhum movimento para mostrar.</p>
        <p className="mt-1 text-xs text-slate-500">Experimenta mudar o mês ou adicionar uma despesa.</p>
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
  });

  return (
    <>
      <ul className="space-y-2">
        {despesas.map((d) => (
          <li key={d.id} className="cartao flex items-center gap-3 p-3">
            <button
              onClick={() => setAEditar(d)}
              className="flex flex-1 items-center gap-3 text-left"
            >
              <span
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sm font-bold"
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
                      className="shrink-0 rounded-md bg-marca-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-marca-300"
                    >
                      IA
                    </span>
                  )}
                </div>
                <p className="truncate text-xs text-slate-400">
                  {[d.categoria_nome, d.membro_nome, formatarData(d.data)]
                    .filter(Boolean)
                    .join(" · ")}
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
              className="rounded-lg p-2 text-slate-500 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-40"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path
                  d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </li>
        ))}
      </ul>

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
