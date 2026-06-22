import { useState } from "react";
import { NavLink } from "react-router-dom";
import { Categoria, Membro, TalaoExtraido } from "../api/client";
import { hojeISO } from "../lib/format";
import Modal from "./Modal";
import ScanTalao from "./ScanTalao";
import FormDespesa, { DadosIniciais } from "./FormDespesa";

interface Props {
  categorias: Categoria[];
  membros: Membro[];
  onGuardado: () => void;
  // "cartoes" = 3 botões brancos (estilo banco); "destaque" = botões grandes;
  // "compacto" = um único botão.
  variante?: "destaque" | "compacto" | "cartoes";
}

type Vista = "fechado" | "scan" | "form";

export default function NovaDespesa({ categorias, membros, onGuardado, variante = "destaque" }: Props) {
  const [vista, setVista] = useState<Vista>("fechado");
  const [inicial, setInicial] = useState<DadosIniciais | undefined>();
  const [talao, setTalao] = useState<
    { confianca: "alta" | "media" | "baixa"; camposEmFalta: string[] } | undefined
  >();

  function abrirManual() {
    setInicial({ data: hojeISO(), origem: "manual" });
    setTalao(undefined);
    setVista("form");
  }

  function aoExtrair(dados: TalaoExtraido) {
    // Faz corresponder a categoria sugerida (por nome) a uma existente.
    const cat = categorias.find(
      (c) => c.nome.toLowerCase() === dados.categoria_sugerida.toLowerCase()
    );
    const camposEmFalta: string[] = [];
    if (dados.valor === null) camposEmFalta.push("valor");
    if (dados.loja === null) camposEmFalta.push("loja");
    if (dados.data === null) camposEmFalta.push("data");

    setInicial({
      valorTexto: dados.valor !== null ? String(dados.valor).replace(".", ",") : "",
      descricao: dados.loja ?? "",
      categoria_id: cat?.id ?? null,
      membro_id: null,
      data: dados.data ?? hojeISO(),
      origem: "talao",
    });
    setTalao({ confianca: dados.confianca, camposEmFalta });
    setVista("form");
  }

  function fechar() {
    setVista("fechado");
    setInicial(undefined);
    setTalao(undefined);
  }

  function guardado() {
    fechar();
    onGuardado();
  }

  return (
    <>
      {variante === "cartoes" ? (
        <div className="grid grid-cols-3 gap-3">
          <CartaoAcao label="Talão" onClick={() => setVista("scan")}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path
                d="M3 8.5A2.5 2.5 0 0 1 5.5 6h1.2c.5 0 .96-.27 1.2-.7l.5-.86A1.5 1.5 0 0 1 10.6 3.7h2.8a1.5 1.5 0 0 1 1.3.74l.5.86c.24.43.7.7 1.2.7h1.1A2.5 2.5 0 0 1 21 8.5v8A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5v-8Z"
                stroke="currentColor"
                strokeWidth="1.7"
              />
              <circle cx="12" cy="12.5" r="3.2" stroke="currentColor" strokeWidth="1.7" />
            </svg>
          </CartaoAcao>
          <CartaoAcao label="Adicionar" destaque onClick={abrirManual}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
            </svg>
          </CartaoAcao>
          <CartaoAcaoLink to="/definicoes" label="Definições">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.9" />
              <path
                d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
                stroke="currentColor"
                strokeWidth="1.4"
              />
            </svg>
          </CartaoAcaoLink>
        </div>
      ) : variante === "destaque" ? (
        <div className="grid grid-cols-1 gap-3">
          <button className="botao-primario py-4 text-lg" onClick={() => setVista("scan")}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path
                d="M3 8.5A2.5 2.5 0 0 1 5.5 6h1.2c.5 0 .96-.27 1.2-.7l.5-.86A1.5 1.5 0 0 1 10.6 3.7h2.8a1.5 1.5 0 0 1 1.3.74l.5.86c.24.43.7.7 1.2.7h1.1A2.5 2.5 0 0 1 21 8.5v8A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5v-8Z"
                stroke="currentColor"
                strokeWidth="1.7"
              />
              <circle cx="12" cy="12.5" r="3.2" stroke="currentColor" strokeWidth="1.7" />
            </svg>
            Fotografar talão
          </button>
          <button className="botao-secundario" onClick={abrirManual}>
            + Adicionar manualmente
          </button>
        </div>
      ) : (
        <button className="botao-primario w-full" onClick={() => setVista("scan")}>
          + Nova despesa
        </button>
      )}

      <Modal titulo="Fotografar talão" aberto={vista === "scan"} onFechar={fechar}>
        <ScanTalao categorias={categorias} onExtraido={aoExtrair} onFechar={fechar} />
        <div className="mt-3 text-center">
          <button className="text-sm text-slate-400 underline" onClick={abrirManual}>
            Prefiro introduzir manualmente
          </button>
        </div>
      </Modal>

      <Modal titulo="Nova despesa" aberto={vista === "form"} onFechar={fechar}>
        <FormDespesa
          categorias={categorias}
          membros={membros}
          inicial={inicial}
          talao={talao}
          onGuardado={guardado}
          onFechar={fechar}
        />
      </Modal>
    </>
  );
}

const chipIcone = (destaque: boolean) =>
  `grid h-12 w-12 place-items-center rounded-2xl transition-transform group-active:scale-90 ${
    destaque
      ? "bg-gradient-to-b from-marca-400 to-marca-600 text-white shadow-md shadow-marca-900/30"
      : "bg-marca-500/12 text-marcatxt"
  }`;

function CartaoAcao({
  label,
  onClick,
  destaque = false,
  children,
}: {
  label: string;
  onClick: () => void;
  destaque?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="cartao group flex flex-col items-center gap-2 px-3 pb-4 pt-10 transition active:scale-95"
    >
      <span className={chipIcone(destaque)}>{children}</span>
      <span className="text-[13px] font-semibold text-slate-200">{label}</span>
    </button>
  );
}

function CartaoAcaoLink({
  to,
  label,
  children,
}: {
  to: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <NavLink to={to} className="cartao group flex flex-col items-center gap-2 px-3 pb-4 pt-10 transition active:scale-95">
      <span className={chipIcone(false)}>{children}</span>
      <span className="text-[13px] font-semibold text-slate-200">{label}</span>
    </NavLink>
  );
}
