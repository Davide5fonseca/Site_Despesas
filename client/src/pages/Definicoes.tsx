import { useEffect, useState } from "react";
import { api, Categoria, Membro, getFamilia, setFamilia, setMembroAtual } from "../api/client";
import { useGrupo } from "../lib/grupo";
import BotaoTema from "../components/BotaoTema";
import Modal from "../components/Modal";
import CabecalhoPagina from "../components/ui/CabecalhoPagina";
import DespesasFixas from "../components/DespesasFixas";

const IconePencil = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
    <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
  </svg>
);
const IconeLixo = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);
const IconePessoaMais = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <circle cx="9" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.8" />
    <path d="M3.5 19a5.5 5.5 0 0 1 10 0M18 8v6M15 11h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const CORES = [
  "#16a34a", "#7c3aed", "#0ea5e9", "#f59e0b",
  "#ef4444", "#ec4899", "#14b8a6", "#64748b",
  "#eab308", "#8b5cf6", "#06b6d4", "#f97316",
];

export default function Definicoes() {
  const { solo, recarregar: recarregarGrupo } = useGrupo();

  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [membros, setMembros] = useState<Membro[]>([]);

  const [novoMembro, setNovoMembro] = useState("");
  const [novaCategoria, setNovaCategoria] = useState("");
  const [novaCor, setNovaCor] = useState(CORES[0]);
  const [erro, setErro] = useState<string | null>(null);

  // Edição
  const [membroEditId, setMembroEditId] = useState<number | null>(null);
  const [membroEditNome, setMembroEditNome] = useState("");
  const [catEditar, setCatEditar] = useState<Categoria | null>(null);
  const [edNome, setEdNome] = useState("");
  const [edCor, setEdCor] = useState(CORES[0]);

  // Conta / grupo
  const [convidar, setConvidar] = useState(false);
  const [apagarAberto, setApagarAberto] = useState(false);
  const [apagarPasso, setApagarPasso] = useState<1 | 2>(1);
  const [apagando, setApagando] = useState(false);
  const [pinApagar, setPinApagar] = useState("");
  const [precisaPinApagar, setPrecisaPinApagar] = useState(false);
  const [erroApagar, setErroApagar] = useState<string | null>(null);

  async function carregar() {
    const [c, m] = await Promise.all([api.listarCategorias(), api.listarMembros()]);
    setCategorias(c);
    setMembros(m);
  }
  useEffect(() => {
    carregar();
  }, []);

  // Sempre que o nº de membros muda, sincroniza o contexto (nav, solo, defaults).
  async function recarregarTudo() {
    await carregar();
    await recarregarGrupo();
  }

  async function adicionarMembro() {
    const nome = novoMembro.trim();
    if (!nome) return;
    setErro(null);
    try {
      await api.criarMembro(nome);
      setNovoMembro("");
      recarregarTudo();
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
    recarregarTudo();
  }

  async function apagarCategoria(id: number) {
    if (!confirm("Apagar esta categoria? As despesas associadas ficam sem categoria.")) return;
    await api.apagarCategoria(id);
    carregar();
  }

  async function guardarMembroEdit() {
    const nome = membroEditNome.trim();
    if (!nome || membroEditId == null) return;
    setErro(null);
    try {
      await api.editarMembro(membroEditId, nome);
      setMembroEditId(null);
      recarregarTudo();
    } catch (e: any) {
      setErro(e?.message || "Falha ao guardar membro.");
    }
  }

  function abrirEditarCategoria(c: Categoria) {
    setCatEditar(c);
    setEdNome(c.nome);
    setEdCor(c.cor);
    setErro(null);
  }
  async function guardarCategoriaEdit() {
    if (!catEditar) return;
    const nome = edNome.trim();
    if (!nome) return;
    setErro(null);
    try {
      await api.editarCategoria(catEditar.id, nome, edCor);
      setCatEditar(null);
      carregar();
    } catch (e: any) {
      setErro(e?.message || "Falha ao guardar categoria.");
    }
  }

  const familia = getFamilia();

  function copiarCodigo() {
    if (familia) navigator.clipboard?.writeText(familia.codigo).catch(() => {});
  }

  // Grupo (2+): só "esquece" neste dispositivo; pode voltar a entrar com o código.
  function sairDoGrupo() {
    if (!confirm("Sair do grupo neste dispositivo? Podes voltar a entrar com o código.")) return;
    setFamilia(null);
    location.reload();
  }

  // Solo: apagar mesmo os dados (destrutivo, confirmação dupla).
  function fecharApagar() {
    setApagarAberto(false);
    setApagarPasso(1);
    setPinApagar("");
    setPrecisaPinApagar(false);
    setErroApagar(null);
  }
  async function confirmarApagar() {
    setApagando(true);
    setErroApagar(null);
    try {
      await api.apagarFamilia(pinApagar.trim() || undefined);
      setMembroAtual(null);
      setFamilia(null);
      location.reload();
    } catch (e: any) {
      setApagando(false);
      if (e?.pinNecessario) {
        setPrecisaPinApagar(true);
        setErroApagar("Este grupo tem PIN. Escreve-o para apagar.");
      } else {
        setErroApagar(e?.message || "Não foi possível apagar os dados.");
      }
    }
  }

  return (
    <div className="palco space-y-6">
      <CabecalhoPagina titulo="Definições" subtitulo="Conta, aparência, membros e categorias" />

      {/* Conta / grupo */}
      {familia && (
        <section className="cartao p-5">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">
            {solo ? "A minha conta" : "O teu grupo"}
          </h2>
          <p className="text-lg font-bold text-slate-100">{familia.nome}</p>

          {solo ? (
            <>
              {!convidar ? (
                <button
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-marca-500/10 py-3 text-sm font-semibold text-marcatxt transition hover:bg-marca-500/15 active:scale-[0.99]"
                  onClick={() => setConvidar(true)}
                >
                  <IconePessoaMais /> Convidar alguém
                </button>
              ) : (
                <div className="mt-4">
                  <p className="text-xs text-slate-400">
                    Este é o teu <span className="text-slate-300">código de acesso</span>. Partilha-o
                    para convidar alguém, ou guarda-o para entrares noutro dispositivo — sem ele não
                    há como recuperar os dados.
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="flex-1 rounded-xl border border-dashed border-marca-500/40 bg-noite-900/50 py-2 text-center text-xl font-extrabold tracking-[0.25em] text-slate-100">
                      {familia.codigo}
                    </span>
                    <button className="botao-secundario px-4 py-2.5" onClick={copiarCodigo}>
                      Copiar
                    </button>
                  </div>
                </div>
              )}

              <button
                className="mt-3 w-full rounded-2xl border border-red-500/30 bg-red-500/10 py-3 text-sm font-semibold text-red-400 transition hover:bg-red-500/20 active:scale-[0.99]"
                onClick={() => {
                  setApagarPasso(1);
                  setApagarAberto(true);
                }}
              >
                Apagar os meus dados
              </button>
            </>
          ) : (
            <>
              <p className="mt-3 text-xs text-slate-400">Código para outros entrarem:</p>
              <div className="mt-1 flex items-center gap-2">
                <span className="flex-1 rounded-xl border border-dashed border-marca-500/40 bg-noite-900/50 py-2 text-center text-xl font-extrabold tracking-[0.25em] text-slate-100">
                  {familia.codigo}
                </span>
                <button className="botao-secundario px-4 py-2.5" onClick={copiarCodigo}>
                  Copiar
                </button>
              </div>
              <button
                className="mt-4 w-full rounded-2xl border border-red-500/30 bg-red-500/10 py-3 text-sm font-semibold text-red-400 transition hover:bg-red-500/20 active:scale-[0.99]"
                onClick={sairDoGrupo}
              >
                Sair do grupo
              </button>
            </>
          )}
        </section>
      )}

      {/* Aparência */}
      <section className="cartao flex items-center justify-between p-5">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Aparência</h2>
          <p className="mt-1 text-sm text-slate-300">Alternar entre tema claro e escuro.</p>
        </div>
        <BotaoTema comRotulo />
      </section>

      {erro && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {erro}
        </p>
      )}

      {/* Membros */}
      <section className="cartao p-5">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Membros</h2>

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
              className="flex items-center justify-between gap-2 rounded-xl bg-noite-900/50 px-3 py-2"
            >
              {membroEditId === m.id ? (
                <>
                  <input
                    className="campo py-1.5"
                    autoFocus
                    value={membroEditNome}
                    onChange={(e) => setMembroEditNome(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && guardarMembroEdit()}
                  />
                  <div className="flex shrink-0 gap-1">
                    <button onClick={guardarMembroEdit} className="rounded-lg p-1.5 text-marcatxt" aria-label="Guardar">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                    <button onClick={() => setMembroEditId(null)} className="rounded-lg p-1.5 text-slate-400" aria-label="Cancelar">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <span className="truncate font-medium text-slate-100">{m.nome}</span>
                  <div className="flex shrink-0 gap-1">
                    <button
                      onClick={() => {
                        setMembroEditId(m.id);
                        setMembroEditNome(m.nome);
                      }}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-linha/5 hover:text-slate-200"
                      aria-label="Editar membro"
                    >
                      <IconePencil />
                    </button>
                    <button
                      onClick={() => apagarMembro(m.id)}
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-red-500/10 hover:text-red-400"
                      aria-label="Apagar membro"
                    >
                      <IconeLixo />
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* Categorias */}
      <section className="cartao p-5">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">
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
                  novaCor === cor ? "ring-2 ring-marca-400 ring-offset-2 ring-offset-noite-800" : ""
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
              <span className="flex min-w-0 items-center gap-3">
                <span className="h-4 w-4 shrink-0 rounded-full" style={{ backgroundColor: c.cor }} />
                <span className="truncate font-medium text-slate-100">{c.nome}</span>
              </span>
              <div className="flex shrink-0 gap-1">
                <button
                  onClick={() => abrirEditarCategoria(c)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-linha/5 hover:text-slate-200"
                  aria-label="Editar categoria"
                >
                  <IconePencil />
                </button>
                <button
                  onClick={() => apagarCategoria(c.id)}
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-red-500/10 hover:text-red-400"
                  aria-label="Apagar categoria"
                >
                  <IconeLixo />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Despesas fixas / subscrições */}
      <DespesasFixas categorias={categorias} membros={membros} />

      <p className="px-1 text-center text-xs text-slate-600">
        ScanWise · PWA · dados guardados no teu servidor
      </p>

      {/* Modal: editar categoria */}
      <Modal titulo="Editar categoria" aberto={catEditar != null} onFechar={() => setCatEditar(null)}>
        <div className="space-y-4">
          <div>
            <label className="rotulo">Nome</label>
            <input
              className="campo"
              value={edNome}
              onChange={(e) => setEdNome(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && guardarCategoriaEdit()}
            />
          </div>
          <div>
            <label className="rotulo">Cor</label>
            <div className="flex flex-wrap gap-2">
              {CORES.map((cor) => (
                <button
                  key={cor}
                  onClick={() => setEdCor(cor)}
                  aria-label={`Cor ${cor}`}
                  className={`h-8 w-8 rounded-full transition ${
                    edCor === cor ? "ring-2 ring-marca-400 ring-offset-2 ring-offset-noite-800" : ""
                  }`}
                  style={{ backgroundColor: cor }}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button className="botao-secundario flex-1" onClick={() => setCatEditar(null)}>
              Cancelar
            </button>
            <button className="botao-primario flex-1" onClick={guardarCategoriaEdit}>
              Guardar
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: apagar os meus dados (confirmação dupla) */}
      <Modal titulo="Apagar os meus dados" aberto={apagarAberto} onFechar={fecharApagar}>
        <div className="space-y-4">
          {apagarPasso === 1 ? (
            <>
              <p className="text-sm text-slate-300">
                Isto apaga <span className="font-semibold text-slate-100">tudo</span>: despesas,
                despesas fixas, categorias e membros. Não há forma de recuperar.
              </p>
              <div className="flex gap-3 pt-1">
                <button className="botao-secundario flex-1" onClick={fecharApagar}>
                  Cancelar
                </button>
                <button className="botao-perigo flex-1" onClick={() => setApagarPasso(2)}>
                  Continuar
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-slate-300">
                Tens mesmo a certeza? Esta ação é{" "}
                <span className="font-semibold text-red-300">irreversível</span>.
              </p>
              {precisaPinApagar && (
                <input
                  className="campo text-center text-lg font-bold tracking-[0.3em]"
                  type="password"
                  inputMode="numeric"
                  placeholder="PIN"
                  maxLength={12}
                  autoFocus
                  value={pinApagar}
                  onChange={(e) => setPinApagar(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && confirmarApagar()}
                />
              )}
              {erroApagar && (
                <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                  {erroApagar}
                </p>
              )}
              <div className="flex gap-3 pt-1">
                <button className="botao-secundario flex-1" onClick={fecharApagar} disabled={apagando}>
                  Voltar atrás
                </button>
                <button className="botao-perigo flex-1" onClick={confirmarApagar} disabled={apagando}>
                  {apagando ? "A apagar…" : "Sim, apagar tudo"}
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
