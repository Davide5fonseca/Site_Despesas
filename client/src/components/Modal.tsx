import { ReactNode, useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

interface Props {
  titulo: string;
  aberto: boolean;
  onFechar: () => void;
  children: ReactNode;
}

// "Bottom sheet" acessível: foco preso, fecha com Esc, role/aria corretos.
export default function Modal({ titulo, aberto, onFechar, children }: Props) {
  const refConteudo = useRef<HTMLDivElement>(null);
  const tituloId = useId();

  useEffect(() => {
    if (!aberto) return;
    const focoAnterior = document.activeElement as HTMLElement | null;
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focaveis = () =>
      Array.from(
        refConteudo.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        ) ?? []
      ).filter((el) => !el.hasAttribute("disabled") && el.offsetParent !== null);

    // Foca o primeiro campo/botão útil ao abrir.
    const t = window.setTimeout(() => {
      const els = focaveis();
      (els.find((el) => el.tagName === "INPUT") ?? els[0])?.focus();
    }, 50);

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onFechar();
        return;
      }
      if (e.key === "Tab") {
        const els = focaveis();
        if (!els.length) return;
        const primeiro = els[0];
        const ultimo = els[els.length - 1];
        if (e.shiftKey && document.activeElement === primeiro) {
          e.preventDefault();
          ultimo.focus();
        } else if (!e.shiftKey && document.activeElement === ultimo) {
          e.preventDefault();
          primeiro.focus();
        }
      }
    }
    document.addEventListener("keydown", onKey);

    return () => {
      window.clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflowAnterior;
      focoAnterior?.focus?.();
    };
  }, [aberto, onFechar]);

  if (!aberto) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onFechar} aria-hidden />
      <div
        ref={refConteudo}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        className="relative w-full max-w-md max-h-[92vh] overflow-y-auto sem-scrollbar
          rounded-t-3xl border-t border-linha/10 bg-noite-800 p-5 pb-8 shadow-cartao
          animate-[subir_0.2s_ease-out]"
        style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-linha/20" />
        <div className="mb-4 flex items-center justify-between">
          <h2 id={tituloId} className="text-lg font-bold text-slate-100">
            {titulo}
          </h2>
          <button
            onClick={onFechar}
            aria-label="Fechar"
            className="rounded-full p-2 text-slate-400 hover:bg-linha/5 hover:text-slate-200"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        {children}
      </div>

      <style>{`@keyframes subir { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
    </div>,
    document.body
  );
}
