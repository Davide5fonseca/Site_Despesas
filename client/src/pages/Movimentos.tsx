import { useCallback, useEffect, useState } from "react";
import { api, Categoria, Despesa, Membro } from "../api/client";
import { formatarEuros, mesAtual } from "../lib/format";
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

  const total = despesas.reduce((s, d) => s + d.valor_centimos, 0);

  return (
    <div className="space-y-4">
      <header className="flex items-baseline justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-100">Movimentos</h1>
        <span className="text-sm text-slate-400">
          {despesas.length} · <span className="font-semibold text-slate-200">{formatarEuros(total)}</span>
        </span>
      </header>

      <Filtros
        mes={mes}
        onMes={setMes}
        categorias={categorias}
        categoria={categoria}
        onCategoria={setCategoria}
      />

      <NovaDespesa categorias={categorias} membros={membros} onGuardado={carregar} variante="compacto" />

      {erro && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {erro}
        </p>
      )}

      <ListaMovimentos
        despesas={despesas}
        categorias={categorias}
        membros={membros}
        onAlterado={carregar}
      />
    </div>
  );
}
