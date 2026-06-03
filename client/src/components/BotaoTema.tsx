import { useTema } from "../lib/tema";

export default function BotaoTema({ comRotulo = false }: { comRotulo?: boolean }) {
  const { tema, alternar } = useTema();
  const escuro = tema === "dark";

  return (
    <button
      onClick={alternar}
      aria-label={escuro ? "Mudar para tema claro" : "Mudar para tema escuro"}
      className="botao-secundario px-4 py-2.5"
    >
      {escuro ? (
        // Lua (está escuro -> oferece claro)
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path
            d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        // Sol
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
          <path
            d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      )}
      {comRotulo && <span>{escuro ? "Tema claro" : "Tema escuro"}</span>}
    </button>
  );
}
