import { lazy, Suspense, useState } from "react";
import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import FamiliaGate from "./components/FamiliaGate";
import BarraSync from "./components/BarraSync";
import { api, Familia, getFamilia } from "./api/client";
import { GrupoProvider, useGrupo } from "./lib/grupo";
import { SyncProvider } from "./lib/sync";

// Lazy-load das páginas: o Recharts (gráficos) só carrega ao abrir o Resumo,
// deixando o arranque inicial muito mais leve.
const Inicio = lazy(() => import("./pages/Inicio"));
const Resumo = lazy(() => import("./pages/Resumo"));
const PorPessoa = lazy(() => import("./pages/PorPessoa"));
const Definicoes = lazy(() => import("./pages/Definicoes"));

export default function App() {
  const [familia, setFamiliaState] = useState<Familia | null>(getFamilia());

  if (!familia) {
    return <FamiliaGate onPronto={setFamiliaState} />;
  }

  return (
    <GrupoProvider>
      <SyncProvider>
        <Autenticado />
      </SyncProvider>
    </GrupoProvider>
  );
}

function Autenticado() {
  const { solo } = useGrupo();

  // A tab "Pessoas" só faz sentido com mais do que uma pessoa.
  const itensNav = [
    { para: "/inicio", rotulo: "Início", Icone: IconeCasa },
    { para: "/resumo", rotulo: "Resumo", Icone: IconeGrafico },
    ...(solo ? [] : [{ para: "/pessoas", rotulo: "Pessoas", Icone: IconePessoas }]),
    { para: "/definicoes", rotulo: "Definições", Icone: IconeEngrenagem },
  ];

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col overflow-x-hidden">
      <main
        className="flex-1 px-4 pb-32"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.25rem)" }}
      >
        <BarraSync />
        <Suspense fallback={<Carregando />}>
          <Routes>
            <Route path="/" element={<Navigate to="/inicio" replace />} />
            <Route path="/inicio" element={<Inicio />} />
            <Route path="/resumo" element={<Resumo />} />
            {/* Solo não tem página Pessoas — redireciona para o Início. */}
            <Route path="/pessoas" element={solo ? <Navigate to="/inicio" replace /> : <PorPessoa />} />
            <Route path="/definicoes" element={<Definicoes />} />
            <Route path="*" element={<Navigate to="/inicio" replace />} />
          </Routes>
        </Suspense>
      </main>

      <GuardaNomeReal />

      {/* Navegação inferior flutuante */}
      <nav
        className="fixed inset-x-0 bottom-0 z-20 px-3"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.6rem)" }}
      >
        <div className="mx-auto flex max-w-md items-stretch justify-around rounded-[1.6rem] border border-linha/10 bg-noite-800/90 px-1.5 py-1.5 backdrop-blur-xl shadow-[0_16px_44px_-14px_rgba(0,0,0,0.6)]">
          {itensNav.map(({ para, rotulo, Icone }) => (
            <NavLink key={para} to={para} className="flex flex-1 flex-col items-center gap-1 py-1">
              {({ isActive }) => (
                <>
                  <span
                    className={`grid h-10 w-10 place-items-center rounded-2xl transition-all duration-200 ${
                      isActive
                        ? "bg-gradient-to-b from-marca-400 to-marca-600 text-white shadow-lg shadow-marca-500/40"
                        : "text-slate-500"
                    }`}
                  >
                    <Icone activo={isActive} />
                  </span>
                  <span
                    className={`text-[11px] font-semibold transition-colors ${
                      isActive ? "text-marcatxt" : "text-slate-500"
                    }`}
                  >
                    {rotulo}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

function Carregando() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-marca-400 border-t-transparent" />
    </div>
  );
}

// Quando um grupo solo passa a ter 2+ pessoas e o "eu" deste dispositivo ainda
// tem o nome default "Eu", obriga a escolher o nome real — senão os outros veem
// "Eu pagou X€" sem saber de quem é. Overlay bloqueante (sem fechar).
function GuardaNomeReal() {
  const { solo, membros, membroAtualId, recarregar } = useGrupo();
  const eu = membros.find((m) => m.id === membroAtualId);
  const precisa = !solo && eu != null && eu.nome.trim().toLowerCase() === "eu";

  const [nome, setNome] = useState("");
  const [aGuardar, setAGuardar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (!precisa) return null;

  async function guardar() {
    const n = nome.trim();
    if (!n) return setErro("Escreve o teu nome.");
    setErro(null);
    setAGuardar(true);
    try {
      await api.editarMembro(eu!.id, n);
      await recarregar();
    } catch (e: any) {
      setErro(e?.message || "Não foi possível guardar.");
      setAGuardar(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-5 backdrop-blur-sm">
      <div className="cartao w-full max-w-sm p-6">
        <h2 className="text-lg font-bold text-slate-100">Como te chamas?</h2>
        <p className="mt-1 text-sm text-slate-400">
          Agora são mais do que um. Escolhe o teu nome para os outros saberem quem registou cada
          despesa.
        </p>
        <input
          className="campo mt-4"
          autoFocus
          placeholder="O teu nome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && guardar()}
        />
        {erro && <p className="mt-2 text-sm text-red-300">{erro}</p>}
        <button className="botao-primario mt-4 w-full" onClick={guardar} disabled={aGuardar}>
          {aGuardar ? "A guardar…" : "Continuar"}
        </button>
      </div>
    </div>
  );
}

function IconeCasa({ activo }: { activo: boolean }) {
  return (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none">
      <path
        d="M3 10.5L12 4l9 6.5M5 9.5V19a1 1 0 0 0 1 1h3v-5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v5h3a1 1 0 0 0 1-1V9.5"
        stroke="currentColor"
        strokeWidth={activo ? 2.1 : 1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconeGrafico({ activo }: { activo: boolean }) {
  return (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth={activo ? 2.1 : 1.8} />
      <path d="M12 4a8 8 0 0 1 8 8h-8z" fill="currentColor" opacity={activo ? 0.9 : 0.5} />
    </svg>
  );
}

function IconePessoas({ activo }: { activo: boolean }) {
  return (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none">
      <circle cx="9" cy="8" r="3.1" stroke="currentColor" strokeWidth={activo ? 2.1 : 1.8} />
      <path
        d="M3.5 19a5.5 5.5 0 0 1 11 0M16.5 5.3a3 3 0 0 1 0 5.4M17.5 19a5.5 5.5 0 0 0-3-4.9"
        stroke="currentColor"
        strokeWidth={activo ? 2.1 : 1.8}
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconeEngrenagem({ activo }: { activo: boolean }) {
  return (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth={activo ? 2.1 : 1.8} />
      <path
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
        stroke="currentColor"
        strokeWidth={activo ? 1.7 : 1.4}
      />
    </svg>
  );
}
