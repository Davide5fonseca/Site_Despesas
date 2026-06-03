import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Tema = "dark" | "light";
const CHAVE = "despesas_tema";

interface CtxTema {
  tema: Tema;
  alternar: () => void;
  definir: (t: Tema) => void;
}

const TemaCtx = createContext<CtxTema>({ tema: "dark", alternar: () => {}, definir: () => {} });

function temaInicial(): Tema {
  const guardado = localStorage.getItem(CHAVE);
  if (guardado === "light" || guardado === "dark") return guardado;
  // Por omissão segue a preferência do sistema.
  return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function TemaProvider({ children }: { children: ReactNode }) {
  const [tema, setTema] = useState<Tema>(temaInicial);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("light", tema === "light");
    root.dataset.tema = tema;
    root.style.colorScheme = tema;
    localStorage.setItem(CHAVE, tema);
  }, [tema]);

  return (
    <TemaCtx.Provider
      value={{ tema, alternar: () => setTema((t) => (t === "dark" ? "light" : "dark")), definir: setTema }}
    >
      {children}
    </TemaCtx.Provider>
  );
}

export const useTema = () => useContext(TemaCtx);
