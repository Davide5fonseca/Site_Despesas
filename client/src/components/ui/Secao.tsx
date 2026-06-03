import { ReactNode } from "react";

// Cartão de secção com cabeçalho consistente (ícone + título + ação opcional).
export default function Secao({
  titulo,
  icone,
  acao,
  children,
  className = "",
  semPadding = false,
}: {
  titulo: string;
  icone?: ReactNode;
  acao?: ReactNode;
  children: ReactNode;
  className?: string;
  semPadding?: boolean;
}) {
  return (
    <section className={`cartao ${semPadding ? "p-0" : "p-5"} ${className}`}>
      <div className={`flex items-center justify-between ${semPadding ? "px-5 pt-5" : ""} mb-3`}>
        <div className="flex items-center gap-2">
          {icone && <span className="text-marcatxt">{icone}</span>}
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">{titulo}</h2>
        </div>
        {acao}
      </div>
      <div className={semPadding ? "px-5 pb-5" : ""}>{children}</div>
    </section>
  );
}
