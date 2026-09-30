import { useEffect, useState } from "react";
import { api, Membro, getMembroAtual, setMembroAtual } from "../api/client";

interface Props {
  // Chamado quando a escolha fica feita (ou saltada).
  onPronto: () => void;
  // Permite fechar sem escolher (em Definições); no arranque é obrigatório.
  onCancelar?: () => void;
}

// "Quem sou eu neste dispositivo": escolhe um membro existente ou cria-se a
// si próprio. Fica guardado em localStorage e passa a ser o default de
// "Quem pagou" e o participante por omissão em "Dividir por".
export default function EscolherMembro({ onPronto, onCancelar }: Props) {
  const [membros, setMembros] = useState<Membro[] | null>(null);
  const [nome, setNome] = useState("");
  const [aGuardar, setAGuardar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const atual = getMembroAtual();

  useEffect(() => {
    api
      .listarMembros()
      .then(setMembros)
      .catch(() => setMembros([]));
  }, []);

  function escolher(id: number) {
    setMembroAtual(id);
    onPronto();
  }

  async function criar() {
    const n = nome.trim();
    if (!n) return setErro("Escreve o teu nome.");
    setErro(null);
    setAGuardar(true);
    try {
      const m = await api.criarMembro(n);
      escolher(m.id);
    } catch (e: any) {
      setErro(e?.message || "Não foi possível criar o membro.");
      setAGuardar(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">
        Assim as despesas que registas ficam já em teu nome e o "acertar contas" sabe quem pagou.
      </p>

      {membros === null ? (
        <p className="text-sm text-slate-500">A carregar…</p>
      ) : membros.length > 0 ? (
        <div>
          <label className="rotulo">Sou…</label>
          <div className="flex flex-wrap gap-2">
            {membros.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => escolher(m.id)}
                className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  atual === m.id
                    ? "border-transparent bg-marca-500 text-white"
                    : "border-linha/10 bg-noite-900/50 text-slate-200 hover:bg-noite-700"
                }`}
              >
                {m.nome}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div>
        <label className="rotulo">{membros?.length ? "Ou sou outra pessoa" : "Como te chamas?"}</label>
        <div className="flex gap-2">
          <input
            className="campo"
            placeholder="O teu nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && criar()}
          />
          <button className="botao-primario shrink-0 px-5" onClick={criar} disabled={aGuardar}>
            {aGuardar ? "…" : "Sou eu"}
          </button>
        </div>
      </div>

      {erro && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{erro}</p>
      )}

      <button
        className="w-full text-center text-sm text-slate-400 underline"
        onClick={() => (onCancelar ? onCancelar() : onPronto())}
      >
        {onCancelar ? "Cancelar" : "Agora não"}
      </button>
    </div>
  );
}
