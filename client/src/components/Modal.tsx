import { ReactNode, useEffect } from "react";

interface Props {
  titulo: string;
  aberto: boolean;
  onFechar: () => void;
  children: ReactNode;
}

// "Bottom sheet" simples, mobile-first.
export default function Modal({ titulo, aberto, onFechar, children }: Props) {
  useEffect(() => {
    if (!aberto) return;
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = anterior;
    };
  }, [aberto]);

  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onFechar} />
      <div
        className="relative w-full max-w-md max-h-[92vh] overflow-y-auto sem-scrollbar
          rounded-t-3xl border-t border-white/10 bg-noite-800 p-5 pb-8 shadow-cartao
          animate-[subir_0.2s_ease-out]"
        style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-white/15" />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-100">{titulo}</h2>
          <button
            onClick={onFechar}
            aria-label="Fechar"
            className="rounded-full p-2 text-slate-400 hover:bg-white/5 hover:text-slate-200"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        {children}
      </div>

      <style>{`@keyframes subir { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
    </div>
  );
}
