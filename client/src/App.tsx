import { useState } from "react";
import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import Inicio from "./pages/Inicio";
import Resumo from "./pages/Resumo";
import PorPessoa from "./pages/PorPessoa";
import Definicoes from "./pages/Definicoes";
import FamiliaGate from "./components/FamiliaGate";
import { Familia, getFamilia } from "./api/client";

const itensNav = [
  { para: "/inicio", rotulo: "Início", Icone: IconeCasa },
  { para: "/resumo", rotulo: "Resumo", Icone: IconeGrafico },
  { para: "/pessoas", rotulo: "Pessoas", Icone: IconePessoas },
  { para: "/definicoes", rotulo: "Definições", Icone: IconeEngrenagem },
];

export default function App() {
  const [familia, setFamiliaState] = useState<Familia | null>(getFamilia());

  if (!familia) {
    return <FamiliaGate onPronto={setFamiliaState} />;
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col overflow-x-hidden">
      <main
        className="flex-1 px-4 pb-32"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.25rem)" }}
      >
        <Routes>
          <Route path="/" element={<Navigate to="/inicio" replace />} />
          <Route path="/inicio" element={<Inicio />} />
          <Route path="/resumo" element={<Resumo />} />
          <Route path="/pessoas" element={<PorPessoa />} />
          <Route path="/definicoes" element={<Definicoes />} />
          <Route path="*" element={<Navigate to="/inicio" replace />} />
        </Routes>
      </main>

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
