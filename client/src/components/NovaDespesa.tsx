import { useState } from "react";
import { Categoria, Membro, TalaoExtraido } from "../api/client";
import { hojeISO } from "../lib/format";
import Modal from "./Modal";
import ScanTalao from "./ScanTalao";
import FormDespesa, { DadosIniciais } from "./FormDespesa";

interface Props {
  categorias: Categoria[];
  membros: Membro[];
  onGuardado: () => void;
  // "destaque" mostra os botões grandes (ecrã Resumo); senão mostra um único botão.
  variante?: "destaque" | "compacto";
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
      {variante === "destaque" ? (
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
        <ScanTalao onExtraido={aoExtrair} onFechar={fechar} />
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
