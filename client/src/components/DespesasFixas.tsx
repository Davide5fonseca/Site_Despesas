import { useCallback, useEffect, useState } from "react";
import { api, Categoria, DespesaFixa, Membro } from "../api/client";
import { formatarEuros } from "../lib/format";
import Modal from "./Modal";
import FormFixa from "./FormFixa";

interface Props {
  categorias: Categoria[];
  membros: Membro[];
}

export default function DespesasFixas({ categorias, membros }: Props) {
  const [fixas, setFixas] = useState<DespesaFixa[]>([]);
  const [nova, setNova] = useState(false);
  const [aEditar, setAEditar] = useState<DespesaFixa | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      setFixas(await api.listarFixas());
    } catch (e: any) {
      setErro(e?.message || "Falha a carregar.");
    }
  }, []);
  useEffect(() => {
    carregar();
  }, [carregar]);

  function fechar() {
    setNova(false);
    setAEditar(null);
  }
  async function apagar(id: number) {
    if (!confirm("Apagar esta despesa fixa? As despesas já geradas mantêm-se.")) return;
    await api.apagarFixa(id);
    carregar();
  }

  const aberto = nova || aEditar != null;

  return (
    <section className="cartao p-5">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Despesas fixas</h2>
        <button className="text-sm font-semibold text-marcatxt" onClick={() => setNova(true)}>
          + Nova
        </button>
      </div>
      <p className="mb-3 text-sm text-slate-400">
        Subscrições e contas que entram sozinhas todos os meses.
      </p>

      {erro && (
        <p className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {erro}
        </p>
      )}

      <ul className="space-y-2">
        {fixas.length === 0 && (
          <li className="rounded-xl bg-noite-900/40 px-3 py-3 text-sm text-slate-500">
            Ainda não tens despesas fixas. Cria a primeira (ex.: Netflix).
          </li>
        )}
        {fixas.map((f) => (
          <li key={f.id} className="flex items-center gap-3 rounded-xl bg-noite-900/50 px-3 py-2.5">
            <span
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sm font-bold ring-1 ring-inset ring-linha/10"
              style={{
                backgroundColor: (f.categoria_cor ?? "#475569") + "26",
                color: f.categoria_cor ?? "#94a3b8",
              }}
            >
              {(f.descricao || f.categoria_nome || "?").charAt(0).toUpperCase()}
            </span>
            <button onClick={() => setAEditar(f)} className="min-w-0 flex-1 text-left">
              <div className="flex items-center gap-2">
                <p className="truncate font-semibold text-slate-100">
                  {f.descricao || f.categoria_nome || "Despesa fixa"}
                </p>
                {!f.ativa && (
                  <span className="shrink-0 rounded bg-slate-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">
                    pausada
                  </span>
                )}
              </div>
              <p className="truncate text-xs text-slate-400">
                Dia {f.dia} · {[f.categoria_nome, f.membro_nome].filter(Boolean).join(" · ") || "Sem categoria"}
              </p>
            </button>
            <span className="shrink-0 font-bold tabular-nums text-slate-100">
              {formatarEuros(f.valor_centimos)}
            </span>
            <button
              onClick={() => apagar(f.id)}
              aria-label="Apagar despesa fixa"
              className="rounded-lg p-1.5 text-slate-500 transition hover:bg-red-500/10 hover:text-red-400"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
            </button>
          </li>
        ))}
      </ul>

      <Modal titulo={aEditar ? "Editar despesa fixa" : "Nova despesa fixa"} aberto={aberto} onFechar={fechar}>
        {aberto && (
          <FormFixa
            key={aEditar ? `e${aEditar.id}` : "nova"}
            categorias={categorias}
            membros={membros}
            inicial={aEditar ?? undefined}
            onGuardado={() => {
              fechar();
              carregar();
            }}
            onFechar={fechar}
          />
        )}
      </Modal>
    </section>
  );
}
