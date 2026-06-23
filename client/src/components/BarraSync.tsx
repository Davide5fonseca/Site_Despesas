import { useState } from "react";
import { getFamilia } from "../api/client";
import { formatarEuros } from "../lib/format";
import { useSync } from "../lib/sync";

// Indicador global "por sincronizar". Aparece só quando há despesas em fila no
// grupo atual. Toca para expandir, ver os itens, sincronizar já ou descartar.
export default function BarraSync() {
  const { itens, sincronizando, online, sincronizar, descartar } = useSync();
  const [aberto, setAberto] = useState(false);

  const codigo = getFamilia()?.codigo;
  const meus = itens.filter((i) => i.codigo === codigo);
  if (meus.length === 0) return null;

  const estado = sincronizando
    ? "A sincronizar…"
    : online
    ? "Vai sincronizar automaticamente"
    : "Sem ligação — fica guardado no telemóvel";

  return (
    <div className="mb-3 overflow-hidden rounded-2xl border border-amber-500/30 bg-amber-500/10">
      <button
        onClick={() => setAberto((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-amber-500/20 text-amber-300">
          {sincronizando ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-amber-300 border-t-transparent" />
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3M18 4v3h-3M6 20v-3h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-amber-200">
            {meus.length} {meus.length === 1 ? "despesa por sincronizar" : "despesas por sincronizar"}
          </p>
          <p className="truncate text-xs text-amber-200/70">{estado}</p>
        </div>
        <svg
          width="18" height="18" viewBox="0 0 24 24" fill="none"
          className={`shrink-0 text-amber-300/80 transition ${aberto ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>

      {aberto && (
        <div className="border-t border-amber-500/20 px-3 pb-3 pt-2">
          <ul className="space-y-1.5">
            {meus.map((i) => (
              <li
                key={i.clienteId}
                className="flex items-center gap-2 rounded-xl bg-noite-900/40 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-100">
                    {i.payload.descricao || "Despesa"}
                  </p>
                  <p className="text-xs text-slate-400">{i.payload.data}</p>
                </div>
                <span className="shrink-0 text-sm font-bold tabular-nums text-slate-100">
                  {formatarEuros(i.payload.valor_centimos)}
                </span>
                <button
                  onClick={() => descartar(i.clienteId)}
                  aria-label="Descartar"
                  className="rounded-lg p-1.5 text-slate-500 transition hover:bg-red-500/10 hover:text-red-400"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
          <button
            onClick={() => sincronizar()}
            disabled={sincronizando || !online}
            className="botao-secundario mt-2 w-full py-2 text-sm disabled:opacity-50"
          >
            {sincronizando ? "A sincronizar…" : online ? "Sincronizar agora" : "Sem ligação"}
          </button>
        </div>
      )}
    </div>
  );
}
