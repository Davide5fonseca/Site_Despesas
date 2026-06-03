import { useCallback, useEffect, useMemo, useState } from "react";
import { api, Categoria, Despesa, Membro } from "../api/client";
import { formatarData, formatarEuros, mesAtual, parseEurosParaCentimos } from "../lib/format";
import { useAtualizarAuto } from "../lib/useAtualizar";
import CabecalhoPagina from "../components/ui/CabecalhoPagina";
import Filtros from "../components/Filtros";
import ListaMovimentos from "../components/ListaMovimentos";
import NovaDespesa from "../components/NovaDespesa";

export default function Movimentos() {
  const [mes, setMes] = useState(mesAtual());
  const [categoria, setCategoria] = useState<number | null>(null);
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [membros, setMembros] = useState<Membro[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  const [pesquisa, setPesquisa] = useState("");
  const [valorMin, setValorMin] = useState("");
  const [valorMax, setValorMax] = useState("");
  const [maisFiltros, setMaisFiltros] = useState(false);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const [d, c, m] = await Promise.all([
        api.listarDespesas({ mes, categoria }),
        api.listarCategorias(),
        api.listarMembros(),
      ]);
      setDespesas(d);
      setCategorias(c);
      setMembros(m);
    } catch (e: any) {
      setErro(e?.message || "Falha a carregar movimentos.");
    }
  }, [mes, categoria]);

  useEffect(() => {
    carregar();
  }, [carregar]);
  useAtualizarAuto(carregar);

  const filtradas = useMemo(() => {
    const q = pesquisa.trim().toLowerCase();
    const min = parseEurosParaCentimos(valorMin);
    const max = parseEurosParaCentimos(valorMax);
    return despesas.filter((d) => {
      if (q) {
        const alvo = `${d.descricao} ${d.categoria_nome ?? ""} ${d.membro_nome ?? ""}`.toLowerCase();
        if (!alvo.includes(q)) return false;
      }
      if (min !== null && d.valor_centimos < min) return false;
      if (max !== null && d.valor_centimos > max) return false;
      return true;
    });
  }, [despesas, pesquisa, valorMin, valorMax]);

  const total = filtradas.reduce((s, d) => s + d.valor_centimos, 0);
  const temFiltrosAtivos = !!(pesquisa || valorMin || valorMax);

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
    const escapar = (c: string) => `"${String(c).replace(/"/g, '""')}"`;
    const csv = [cab, ...linhas].map((l) => l.map(escapar).join(";")).join("\r\n");
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
    <div className="space-y-4">
      <CabecalhoPagina
        titulo="Movimentos"
        subtitulo={`${filtradas.length} ${filtradas.length === 1 ? "despesa" : "despesas"}`}
        acao={
          <div className="rounded-2xl bg-noite-800/70 px-4 py-2 text-right">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Total</p>
            <p className="font-bold tabular-nums text-slate-100">{formatarEuros(total)}</p>
          </div>
        }
      />

      <Filtros mes={mes} onMes={setMes} categorias={categorias} categoria={categoria} onCategoria={setCategoria} />

      {/* Pesquisa + acesso a mais filtros */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                <path d="M20 20l-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </span>
            <input
              className="campo pl-10"
              placeholder="Procurar despesa…"
              value={pesquisa}
              onChange={(e) => setPesquisa(e.target.value)}
            />
          </div>
          <button
            onClick={() => setMaisFiltros((v) => !v)}
            className={`botao-secundario shrink-0 px-4 ${
              maisFiltros || valorMin || valorMax ? "ring-2 ring-marca-400" : ""
            }`}
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
            <div className="flex gap-2">
              <button className="botao-secundario flex-1" onClick={exportarCSV} disabled={!filtradas.length}>
                Exportar CSV
              </button>
              {temFiltrosAtivos && (
                <button
                  className="botao-secundario flex-1"
                  onClick={() => {
                    setPesquisa("");
                    setValorMin("");
                    setValorMax("");
                  }}
                >
                  Limpar
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <NovaDespesa categorias={categorias} membros={membros} onGuardado={carregar} variante="compacto" />

      {erro && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {erro}
        </p>
      )}

      <ListaMovimentos despesas={filtradas} categorias={categorias} membros={membros} onAlterado={carregar} />
    </div>
  );
}
