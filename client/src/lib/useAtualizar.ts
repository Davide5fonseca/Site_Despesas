import { useEffect } from "react";

// Atualiza os dados quando a app volta a primeiro plano (foco / visível) e,
// enquanto está visível, refresca de tempos a tempos — para ver o que outras
// pessoas da família adicionaram, sem ações manuais.
export function useAtualizarAuto(carregar: () => void, intervaloMs = 20000) {
  useEffect(() => {
    const aoVoltar = () => {
      if (document.visibilityState === "visible") carregar();
    };
    window.addEventListener("focus", aoVoltar);
    document.addEventListener("visibilitychange", aoVoltar);
    const timer = window.setInterval(aoVoltar, intervaloMs);
    return () => {
      window.removeEventListener("focus", aoVoltar);
      document.removeEventListener("visibilitychange", aoVoltar);
      window.clearInterval(timer);
    };
  }, [carregar, intervaloMs]);
}
