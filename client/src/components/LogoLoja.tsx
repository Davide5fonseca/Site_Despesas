import { useState } from "react";
import type { Loja } from "../lib/lojas";

interface Props {
  loja: Loja;
  tamanho?: number; // px (default 44)
  className?: string;
}

// Fontes de logótipo, por ordem de preferência. São pedidas em runtime (como o
// browser faz com qualquer imagem) — não guardamos os ficheiros no projeto.
//   1) Clearbit: logótipo real, nítido, devolve 404 quando não existe (-> tenta a 2ª)
//   2) Favicon do Google: quase sempre existe, mais pequeno
// Se ambas falharem (sem internet, marca sem logo) -> fallback emoji + cor.
function fontes(dominio: string): string[] {
  return [
    `https://logo.clearbit.com/${dominio}`,
    `https://www.google.com/s2/favicons?domain=${dominio}&sz=128`,
  ];
}

export default function LogoLoja({ loja, tamanho = 44, className = "" }: Props) {
  const urls = loja.dominio ? fontes(loja.dominio) : [];
  const [idx, setIdx] = useState(0);

  const estilo = { width: tamanho, height: tamanho };
  const raio = tamanho >= 36 ? "rounded-2xl" : "rounded-xl";

  // Sem mais URLs para tentar (ou sem domínio) -> avatar emoji + cor da marca.
  if (idx >= urls.length) {
    return (
      <span
        className={`grid shrink-0 place-items-center ${raio} ring-1 ring-inset ring-linha/10 ${className}`}
        style={{ ...estilo, backgroundColor: loja.cor + "26", color: loja.cor, fontSize: tamanho * 0.45 }}
      >
        {loja.emoji}
      </span>
    );
  }

  return (
    <span
      className={`grid shrink-0 place-items-center overflow-hidden ${raio} bg-white ring-1 ring-inset ring-black/10 ${className}`}
      style={estilo}
    >
      <img
        src={urls[idx]}
        alt={loja.nome}
        width={tamanho}
        height={tamanho}
        loading="lazy"
        referrerPolicy="no-referrer"
        className="h-full w-full object-contain p-1.5"
        onError={() => setIdx((i) => i + 1)}
      />
    </span>
  );
}
