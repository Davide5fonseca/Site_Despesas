import { useState } from "react";
import { NavLink } from "react-router-dom";
import { api, Categoria, Despesa, Membro, TalaoExtraido } from "../api/client";
import { formatarEuros, formatarNumero, hojeISO } from "../lib/format";
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

type Vista = "fechado" | "scan" | "form" | "duplicado";

function dataCurta(iso: string): string {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

export default function NovaDespesa({ categorias, membros, onGuardado, variante = "destaque" }: Props) {
  const [vista, setVista] = useState<Vista>("fechado");
  const [inicial, setInicial] = useState<DadosIniciais | undefined>();
  const [talao, setTalao] = useState<
    { confianca: "alta" | "media" | "baixa"; camposEmFalta: string[] } | undefined
  >();
  const [duplicado, setDuplicado] = useState<Despesa | null>(null);

  function abrirManual() {
    setInicial({ data: hojeISO(), origem: "manual" });
    setTalao(undefined);
    setDuplicado(null);
    setVista("form");
  }

  function iniciaisDoExistente(d: Despesa): DadosIniciais {
    return {
      id: d.id,
      valorTexto: formatarNumero(d.valor_centimos),
      descricao: d.descricao,
      categoria_id: d.categoria_id,
      membro_id: d.membro_id,
      data: d.data,
      origem: d.origem,
      participantes: d.participantes,
    };
  }

  async function aoExtrair(dados: TalaoExtraido) {
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
      talaoId: dados.talaoId ?? null,
      ivaCentimos: dados.iva != null ? Math.round(dados.iva * 100) : null,
    });
    setTalao({ confianca: dados.confianca, camposEmFalta });

    // Deteção de duplicados: se o talão tem chave única, vê se já existe no grupo.
    if (dados.talaoId) {
      try {
        const existentes = await api.verificarTalao(dados.talaoId);
        if (existentes.length > 0) {
          setDuplicado(existentes[0]);
          setVista("duplicado");
          return;
        }
      } catch {
        /* sem rede ou falha → não bloqueia, segue para o formulário */
      }
    }
    setDuplicado(null);
    setVista("form");
  }

  function fechar() {
    setVista("fechado");
    setInicial(undefined);
    setTalao(undefined);
    setDuplicado(null);
  }

  function guardado() {
    fechar();
    onGuardado();
  }

  // "Registar à mesma": mantém os dados scaneados e abre o formulário.
  function registarAMesma() {
    setDuplicado(null);
    setVista("form");
  }

  // "Ver o existente": abre a despesa já registada em modo de edição.
  function verExistente() {
    if (!duplicado) return;
    setInicial(iniciaisDoExistente(duplicado));
    setTalao(undefined);
    setDuplicado(null);
    setVista("form");
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
        <ScanTalao
          categorias={categorias}
          onExtraido={aoExtrair}
          onManual={abrirManual}
          onFechar={fechar}
        />
        <div className="mt-3 text-center">
          <button className="text-sm text-slate-400 underline" onClick={abrirManual}>
            Prefiro introduzir manualmente
          </button>
        </div>
      </Modal>

      {/* Aviso de talão já registado (não bloqueia) */}
      <Modal titulo="Talão já registado" aberto={vista === "duplicado"} onFechar={fechar}>
        {duplicado && (
          <div className="space-y-4">
            <p className="text-sm text-slate-300">
              Já registaste este talão em{" "}
              <span className="font-semibold text-slate-100">{dataCurta(duplicado.data)}</span>.
            </p>
            <div className="rounded-2xl bg-noite-900/50 px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="truncate font-semibold text-slate-100">
                  {duplicado.descricao || duplicado.categoria_nome || "Despesa"}
                </span>
                <span className="shrink-0 font-bold tabular-nums text-slate-100">
                  {formatarEuros(duplicado.valor_centimos)}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-400">
                {[duplicado.categoria_nome, duplicado.membro_nome].filter(Boolean).join(" · ") ||
                  "Sem categoria"}
              </p>
            </div>
            <div className="flex gap-3 pt-1">
              <button className="botao-secundario flex-1" onClick={verExistente}>
                Ver o existente
              </button>
              <button className="botao-primario flex-1" onClick={registarAMesma}>
                Registar à mesma
              </button>
            </div>
          </div>
        )}
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
