import { ReactNode } from "react";

export default function CabecalhoPagina({
  titulo,
  subtitulo,
  acao,
}: {
  titulo: string;
  subtitulo?: string;
  acao?: ReactNode;
}) {
  return (
    <header className="flex items-start justify-between gap-3 pt-1">
      <div className="min-w-0">
        <h1 className="text-[26px] font-extrabold leading-tight tracking-tight text-slate-100">
          {titulo}
        </h1>
        {subtitulo && <p className="mt-0.5 text-sm text-slate-400">{subtitulo}</p>}
      </div>
      {acao && <div className="shrink-0">{acao}</div>}
    </header>
  );
}
