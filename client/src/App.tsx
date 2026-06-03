import { useState } from "react";
import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import Resumo from "./pages/Resumo";
import Movimentos from "./pages/Movimentos";
import PorPessoa from "./pages/PorPessoa";
import Definicoes from "./pages/Definicoes";
import FamiliaGate from "./components/FamiliaGate";
import { Familia, getFamilia } from "./api/client";

const itensNav = [
  { para: "/resumo", rotulo: "Resumo", Icone: IconeGrafico },
  { para: "/movimentos", rotulo: "Movimentos", Icone: IconeLista },
  { para: "/pessoas", rotulo: "Pessoas", Icone: IconePessoas },
  { para: "/definicoes", rotulo: "Definições", Icone: IconeEngrenagem },
];

export default function App() {
  const [familia, setFamiliaState] = useState<Familia | null>(getFamilia());

  // Sem família escolhida -> ecrã de criar/entrar.
  if (!familia) {
    return <FamiliaGate onPronto={setFamiliaState} />;
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col">
      <main className="flex-1 px-4 pb-28 pt-5">
        <Routes>
          <Route path="/" element={<Navigate to="/resumo" replace />} />
          <Route path="/resumo" element={<Resumo />} />
          <Route path="/movimentos" element={<Movimentos />} />
          <Route path="/pessoas" element={<PorPessoa />} />
          <Route path="/definicoes" element={<Definicoes />} />
          <Route path="*" element={<Navigate to="/resumo" replace />} />
        </Routes>
      </main>

      {/* Navegação inferior fixa, estilo app nativa */}
      <nav
        className="fixed inset-x-0 bottom-0 z-20 border-t border-linha/10 bg-noite-800/90 backdrop-blur-lg"
        style={{ paddingBottom: "env(safe-area-inset-bottom)", boxShadow: "0 -8px 24px -16px rgba(0,0,0,0.6)" }}
      >
        <div className="mx-auto flex max-w-md items-stretch justify-around px-2 py-1.5">
          {itensNav.map(({ para, rotulo, Icone }) => (
            <NavLink key={para} to={para} className="flex flex-1 flex-col items-center">
              {({ isActive }) => (
                <span
                  className={`flex w-full flex-col items-center gap-1 py-1.5 transition ${
                    isActive ? "text-marcatxt" : "text-slate-500"
                  }`}
                >
                  <span
                    className={`grid place-items-center rounded-2xl px-5 py-1 transition-all duration-200 ${
                      isActive ? "bg-marca-500/15" : ""
                    }`}
                  >
                    <Icone activo={isActive} />
                  </span>
                  <span className="text-[11px] font-semibold">{rotulo}</span>
                </span>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

function IconeGrafico({ activo }: { activo: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 19V5M10 19V9M16 19v-6M22 19H2"
        stroke="currentColor"
        strokeWidth={activo ? 2.4 : 2}
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconeLista({ activo }: { activo: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path
        d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"
        stroke="currentColor"
        strokeWidth={activo ? 2.4 : 2}
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconePessoas({ activo }: { activo: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <circle cx="9" cy="8" r="3.2" stroke="currentColor" strokeWidth={activo ? 2.2 : 1.8} />
      <path
        d="M3.5 19a5.5 5.5 0 0 1 11 0M16.5 5.2a3 3 0 0 1 0 5.6M17 19a5.5 5.5 0 0 0-3-4.9"
        stroke="currentColor"
        strokeWidth={activo ? 2.2 : 1.8}
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconeEngrenagem({ activo }: { activo: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth={activo ? 2.4 : 2} />
      <path
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
        stroke="currentColor"
        strokeWidth={activo ? 1.8 : 1.5}
      />
    </svg>
  );
}
