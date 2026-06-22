import { useCallback, useEffect, useMemo, useState } from "react";
import { api, Categoria, Despesa, Membro, getFamilia } from "../api/client";
import {
  formatarData,
  formatarEuros,
  formatarMes,
  mesAtual,
  parseEurosParaCentimos,
} from "../lib/format";
import { useAtualizarAuto } from "../lib/useAtualizar";
import { deslocarMes } from "../components/ui/SeletorMes";
import NovaDespesa from "../components/NovaDespesa";
import ListaMovimentos from "../components/ListaMovimentos";
import { SkeletonLista } from "../components/ui/Skeleton";

export default function Inicio() {
  const familia = getFamilia();
  const [mes, setMes] = useState(mesAtual());
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [membros, setMembros] = useState<Membro[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // Filtros (client-side, sobre o mês carregado)
  const [catFiltro, setCatFiltro] = useState<number | null>(null);
  const [pesquisa, setPesquisa] = useState("");
  const [valorMin, setValorMin] = useState("");
  const [valorMax, setValorMax] = useState("");
  const [maisFiltros, setMaisFiltros] = useState(false);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const [d, c, m] = await Promise.all([
        api.listarDespesas({ mes }),
        api.listarCategorias(),
        api.listarMembros(),
      ]);
      setDespesas(d);
      setCategorias(c);
      setMembros(m);
    } catch (e: any) {
      setErro(e?.message || "Falha a carregar.");
    } finally {
      setCarregando(false);
    }
  }, [mes]);

  useEffect(() => {
    carregar();
  }, [carregar]);
  useAtualizarAuto(carregar);

  const totalMes = despesas.reduce((s, d) => s + d.valor_centimos, 0);

  const filtradas = useMemo(() => {
    const q = pesquisa.trim().toLowerCase();
    const min = parseEurosParaCentimos(valorMin);
    const max = parseEurosParaCentimos(valorMax);
    return despesas.filter((d) => {
      if (catFiltro !== null && d.categoria_id !== catFiltro) return false;
      if (q) {
        const alvo = `${d.descricao} ${d.categoria_nome ?? ""} ${d.membro_nome ?? ""}`.toLowerCase();
        if (!alvo.includes(q)) return false;
      }
      if (min !== null && d.valor_centimos < min) return false;
      if (max !== null && d.valor_centimos > max) return false;
      return true;
    });
  }, [despesas, catFiltro, pesquisa, valorMin, valorMax]);

  function exportarCSV() {
    const cab = ["Data", "Descrição", "Categoria", "Quem pagou", "Valor (EUR)", "Origem"];
    const linhas = filtradas.map((d) => [
      formatarData(d.data),
      d.descricao,
      d.categoria_nome ?? "",
      d.membro_nome ?? "",
      (d.valor_centimos / 100).toFixed(2).replace(".", ","),
      d.origem,
    ]);
    const esc = (c: string) => `"${String(c).replace(/"/g, '""')}"`;
    const csv = [cab, ...linhas].map((l) => l.map(esc).join(";")).join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `despesas-${mes}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="palco space-y-4">
      {/* HERO verde (full-bleed, até ao topo) + cartões de ação */}
      <div
        className="-mx-4"
        style={{ marginTop: "calc(-1 * (env(safe-area-inset-top) + 1.25rem))" }}
      >
        <section
          className="rounded-b-[2rem] bg-gradient-to-b from-marca-500 to-marca-700 px-5 pb-14 text-white"
          style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.1rem)" }}
        >
          {/* Topo: família + navegação de mês */}
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-white/90">{familia?.nome ?? "A nossa casa"}</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setMes(deslocarMes(mes, -1))}
                aria-label="Mês anterior"
                className="rounded-lg p-1.5 text-white/80 transition hover:bg-white/15 active:scale-90"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                </svg>
              </button>
              <span className="min-w-[92px] text-center text-xs font-medium text-white/90">
                {formatarMes(mes)}
              </span>
              <button
                onClick={() => setMes(deslocarMes(mes, 1))}
                aria-label="Mês seguinte"
                className="rounded-lg p-1.5 text-white/80 transition hover:bg-white/15 active:scale-90"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>

          {/* Total do mês */}
          <div className="mt-6 text-center">
            <p className="text-[44px] font-extrabold leading-none tracking-tight tabular-nums">
              {carregando ? "—" : formatarEuros(totalMes)}
            </p>
            <p className="mt-2 text-sm text-white/75">Gasto este mês</p>
          </div>
        </section>

        {/* Cartões de ação (sobrepostos ao verde) */}
        <div className="-mt-9 px-4">
          <NovaDespesa categorias={categorias} membros={membros} onGuardado={carregar} variante="cartoes" />
        </div>
      </div>

      {/* Pesquisa */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
              <path d="M20 20l-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </span>
          <input
            className="campo pl-10 !bg-noite-800 shadow-sm"
            placeholder="Procurar despesa…"
            value={pesquisa}
            onChange={(e) => setPesquisa(e.target.value)}
          />
        </div>
        <button
          onClick={() => setMaisFiltros((v) => !v)}
          className={`botao-secundario shrink-0 px-4 ${maisFiltros || valorMin || valorMax ? "ring-2 ring-marca-400" : ""}`}
          aria-label="Mais filtros"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M3 5h18M6 12h12M10 19h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {maisFiltros && (
        <div className="cartao space-y-3 p-4">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="rotulo">Valor mínimo</label>
              <input className="campo" inputMode="decimal" placeholder="€" value={valorMin} onChange={(e) => setValorMin(e.target.value)} />
            </div>
            <div className="flex-1">
              <label className="rotulo">Valor máximo</label>
              <input className="campo" inputMode="decimal" placeholder="€" value={valorMax} onChange={(e) => setValorMax(e.target.value)} />
            </div>
          </div>
          <button className="botao-secundario w-full" onClick={exportarCSV} disabled={!filtradas.length}>
            Exportar CSV
          </button>
        </div>
      )}

      {/* Chips de categoria (filtro client-side) */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sem-scrollbar">
        <Chip ativo={catFiltro === null} onClick={() => setCatFiltro(null)}>
          Todas
        </Chip>
        {categorias.map((c) => (
          <Chip key={c.id} ativo={catFiltro === c.id} onClick={() => setCatFiltro(c.id)} cor={c.cor}>
            {c.nome}
          </Chip>
        ))}
      </div>

      {erro && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {erro}
        </p>
      )}

      {/* Lista de despesas */}
      <div>
        <div className="mb-2 flex items-center justify-between px-1">
          <h2 className="text-base font-bold text-slate-100">Despesas</h2>
          <span className="text-sm text-slate-400">
            {filtradas.length} · <span className="font-semibold text-slate-200">{formatarEuros(filtradas.reduce((s, d) => s + d.valor_centimos, 0))}</span>
          </span>
        </div>
        {carregando ? (
          <SkeletonLista />
        ) : (
          <ListaMovimentos despesas={filtradas} categorias={categorias} membros={membros} onAlterado={carregar} />
        )}
      </div>
    </div>
  );
}

// Chip "preto/verde" estilo banco (selecionado = escuro/marca)
function Chip({
  children,
  ativo,
  onClick,
  cor,
}: {
  children: React.ReactNode;
  ativo: boolean;
  onClick: () => void;
  cor?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition ${
        ativo
          ? "bg-slate-100 text-noite-900"
          : "border border-linha/10 bg-noite-800 text-slate-400 hover:bg-noite-700"
      }`}
    >
      {cor && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: cor }} />}
      {children}
    </button>
  );
}
