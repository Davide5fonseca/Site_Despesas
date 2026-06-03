import { useEffect, useState } from "react";
import { api, Categoria, Membro } from "../api/client";

const CORES = [
  "#16a34a", "#7c3aed", "#0ea5e9", "#f59e0b",
  "#ef4444", "#ec4899", "#14b8a6", "#64748b",
  "#eab308", "#8b5cf6", "#06b6d4", "#f97316",
];

export default function Definicoes() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [membros, setMembros] = useState<Membro[]>([]);

  const [novoMembro, setNovoMembro] = useState("");
  const [novaCategoria, setNovaCategoria] = useState("");
  const [novaCor, setNovaCor] = useState(CORES[0]);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    const [c, m] = await Promise.all([api.listarCategorias(), api.listarMembros()]);
    setCategorias(c);
    setMembros(m);
  }
  useEffect(() => {
    carregar();
  }, []);

  async function adicionarMembro() {
    const nome = novoMembro.trim();
    if (!nome) return;
    setErro(null);
    try {
      await api.criarMembro(nome);
      setNovoMembro("");
      carregar();
    } catch (e: any) {
      setErro(e?.message || "Falha ao adicionar membro.");
    }
  }

  async function adicionarCategoria() {
    const nome = novaCategoria.trim();
    if (!nome) return;
    setErro(null);
    try {
      await api.criarCategoria(nome, novaCor);
      setNovaCategoria("");
      carregar();
    } catch (e: any) {
      setErro(e?.message || "Falha ao adicionar categoria.");
    }
  }

  async function apagarMembro(id: number) {
    if (!confirm("Apagar este membro? As despesas associadas ficam sem pessoa.")) return;
    await api.apagarMembro(id);
    carregar();
  }

  async function apagarCategoria(id: number) {
    if (!confirm("Apagar esta categoria? As despesas associadas ficam sem categoria.")) return;
    await api.apagarCategoria(id);
    carregar();
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-100">Definições</h1>
        <p className="text-sm text-slate-400">Membros da casa e categorias de despesa.</p>
      </header>

      {erro && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {erro}
        </p>
      )}

      {/* Membros */}
      <section className="cartao p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Membros da casa
        </h2>

        <div className="flex gap-2">
          <input
            className="campo"
            placeholder="Nome (ex.: Ana)"
            value={novoMembro}
            onChange={(e) => setNovoMembro(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && adicionarMembro()}
          />
          <button className="botao-primario px-5" onClick={adicionarMembro}>
            Add
          </button>
        </div>

        <ul className="mt-3 space-y-2">
          {membros.length === 0 && (
            <li className="text-sm text-slate-500">Ainda sem membros. Adiciona o primeiro acima.</li>
          )}
          {membros.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between rounded-xl bg-noite-900/50 px-3 py-2.5"
            >
              <span className="font-medium text-slate-100">{m.nome}</span>
              <button
                onClick={() => apagarMembro(m.id)}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-red-500/10 hover:text-red-400"
                aria-label="Apagar membro"
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
      </section>

      {/* Categorias */}
      <section className="cartao p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Categorias
        </h2>

        <div className="space-y-3">
          <input
            className="campo"
            placeholder="Nova categoria (ex.: Animais)"
            value={novaCategoria}
            onChange={(e) => setNovaCategoria(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && adicionarCategoria()}
          />
          <div className="flex flex-wrap gap-2">
            {CORES.map((cor) => (
              <button
                key={cor}
                onClick={() => setNovaCor(cor)}
                aria-label={`Cor ${cor}`}
                className={`h-8 w-8 rounded-full transition ${
                  novaCor === cor ? "ring-2 ring-white ring-offset-2 ring-offset-noite-800" : ""
                }`}
                style={{ backgroundColor: cor }}
              />
            ))}
          </div>
          <button className="botao-primario w-full" onClick={adicionarCategoria}>
            + Adicionar categoria
          </button>
        </div>

        <ul className="mt-4 space-y-2">
          {categorias.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between rounded-xl bg-noite-900/50 px-3 py-2.5"
            >
              <span className="flex items-center gap-3">
                <span className="h-4 w-4 rounded-full" style={{ backgroundColor: c.cor }} />
                <span className="font-medium text-slate-100">{c.nome}</span>
              </span>
              <button
                onClick={() => apagarCategoria(c.id)}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-red-500/10 hover:text-red-400"
                aria-label="Apagar categoria"
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
      </section>

      <p className="px-1 text-center text-xs text-slate-600">
        Despesas da Casa · PWA · dados guardados no teu servidor
      </p>
    </div>
  );
}
