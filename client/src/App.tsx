import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import Resumo from "./pages/Resumo";
import Movimentos from "./pages/Movimentos";
import Definicoes from "./pages/Definicoes";

const itensNav = [
  { para: "/resumo", rotulo: "Resumo", Icone: IconeGrafico },
  { para: "/movimentos", rotulo: "Movimentos", Icone: IconeLista },
  { para: "/definicoes", rotulo: "Definições", Icone: IconeEngrenagem },
];

export default function App() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col">
      <main className="flex-1 px-4 pb-28 pt-5">
        <Routes>
          <Route path="/" element={<Navigate to="/resumo" replace />} />
          <Route path="/resumo" element={<Resumo />} />
          <Route path="/movimentos" element={<Movimentos />} />
          <Route path="/definicoes" element={<Definicoes />} />
          <Route path="*" element={<Navigate to="/resumo" replace />} />
        </Routes>
      </main>

      {/* Navegação inferior fixa, estilo app nativa */}
      <nav
        className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-noite-800/95 backdrop-blur"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto flex max-w-md items-stretch justify-around">
          {itensNav.map(({ para, rotulo, Icone }) => (
            <NavLink
              key={para}
              to={para}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-1 py-3 text-xs font-medium transition ${
                  isActive ? "text-marca-300" : "text-slate-500"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icone activo={isActive} />
                  <span>{rotulo}</span>
                </>
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
