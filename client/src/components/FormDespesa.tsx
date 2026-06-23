import { useState } from "react";
import { api, Categoria, Membro, Origem, gerarClienteId, getFamilia } from "../api/client";
import { hojeISO, parseEurosParaCentimos } from "../lib/format";
import { reconhecerLoja } from "../lib/lojas";
import { useGrupo } from "../lib/grupo";
import { useSync } from "../lib/sync";
import LogoLoja from "./LogoLoja";

export interface DadosIniciais {
  id?: number;
  valorTexto?: string; // ex.: "12,50"
  descricao?: string;
  categoria_id?: number | null;
  membro_id?: number | null;
  data?: string; // YYYY-MM-DD
  origem?: Origem;
  participantes?: number[]; // quem divide o custo
  talaoId?: string | null; // chave única do talão (scan) — para deteção de duplicados
}

interface Props {
  categorias: Categoria[];
  membros: Membro[];
  inicial?: DadosIniciais;
  // Quando vem de um talão lido por IA:
  talao?: { confianca: "alta" | "media" | "baixa"; camposEmFalta: string[] };
  onGuardado: () => void;
  onFechar: () => void;
}

const corConfianca: Record<string, string> = {
  alta: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30",
  media: "text-amber-300 bg-amber-500/10 border-amber-500/30",
  baixa: "text-red-300 bg-red-500/10 border-red-500/30",
};

// Falha por falta de rede? (offline ou fetch que rebenta antes de resposta)
function semRede(e: any): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  const msg = String(e?.message || e || "").toLowerCase();
  return e?.name === "TypeError" || /failed to fetch|network|load failed/.test(msg);
}

export default function FormDespesa({ categorias, membros, inicial, talao, onGuardado, onFechar }: Props) {
  const { solo, membroAtualId } = useGrupo();
  const { enfileirar } = useSync();
  const editar = inicial?.id != null;

  const [valor, setValor] = useState(inicial?.valorTexto ?? "");
  const [descricao, setDescricao] = useState(inicial?.descricao ?? "");
  const [categoriaId, setCategoriaId] = useState<number | "">(inicial?.categoria_id ?? "");
  // "Quem pagou": ao criar, default = o utilizador atual (não "Ninguém").
  const [membroId, setMembroId] = useState<number | "">(
    inicial?.membro_id ?? membroAtualId ?? ""
  );
  const [data, setData] = useState(inicial?.data ?? hojeISO());
  // "Dividir por": ao editar usa o que estava guardado; ao criar, default = só eu
  // (se souber quem sou), senão todos os membros.
  const [participantes, setParticipantes] = useState<number[]>(
    inicial?.participantes ??
      (membroAtualId != null ? [membroAtualId] : membros.map((m) => m.id))
  );
  const [aGuardar, setAGuardar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const alternarParticipante = (id: number) =>
    setParticipantes((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const emFalta = (campo: string) => talao?.camposEmFalta.includes(campo);
  const loja = reconhecerLoja(descricao);

  async function guardar() {
    setErro(null);
    const centimos = parseEurosParaCentimos(valor);
    if (centimos === null) {
      setErro("Indica um valor válido (ex.: 12,50).");
      return;
    }
    setAGuardar(true);

    // No solo a despesa fica atribuída ao próprio (participante = eu), mesmo
    // sem o seletor "Dividir por" visível.
    const participantesFinais = solo
      ? membroAtualId != null
        ? [membroAtualId]
        : membros.map((m) => m.id)
      : participantes;

    const payload = {
      valor_centimos: centimos,
      descricao: descricao.trim(),
      categoria_id: categoriaId === "" ? null : Number(categoriaId),
      membro_id: membroId === "" ? null : Number(membroId),
      data,
      origem: inicial?.origem ?? "manual",
      participantes: participantesFinais,
      talao_id: inicial?.talaoId ?? null,
      cliente_id: gerarClienteId(),
    };

    try {
      if (editar) await api.editarDespesa(inicial!.id!, payload);
      else await api.criarDespesa(payload);
      onGuardado();
    } catch (e: any) {
      // Sem rede ao CRIAR → guarda na fila local e fecha (sincroniza depois).
      if (!editar && semRede(e)) {
        const fam = getFamilia();
        if (fam) {
          try {
            await enfileirar(payload, fam.codigo);
            onGuardado();
            return;
          } catch {
            setErro("Não foi possível guardar offline neste dispositivo.");
          }
        } else {
          setErro("Sem grupo ativo.");
        }
      } else {
        setErro(e?.message || "Não foi possível guardar.");
      }
    } finally {
      setAGuardar(false);
    }
  }

  return (
    <div className="space-y-4">
      {talao && (
        <div className={`rounded-2xl border px-4 py-3 text-sm ${corConfianca[talao.confianca]}`}>
          <p className="font-semibold">Talão lido · confiança {talao.confianca}</p>
          <p className="mt-0.5 opacity-90">
            {talao.camposEmFalta.length
              ? `Confirma os dados e preenche o que está em falta (${talao.camposEmFalta.join(", ")}).`
              : "Confirma os dados antes de gravar."}
          </p>
        </div>
      )}

      <div>
        <label className="rotulo">Valor (€)</label>
        <input
          type="text"
          inputMode="decimal"
          placeholder="0,00"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          className={`campo text-2xl font-bold ${emFalta("valor") ? "ring-2 ring-amber-400" : ""}`}
          autoFocus={!editar}
        />
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="rotulo mb-0">Descrição</label>
          {loja && (
            <span
              className="flex items-center gap-1.5 rounded-full py-0.5 pl-0.5 pr-2.5 text-xs font-semibold"
              style={{ backgroundColor: loja.cor + "22", color: loja.cor }}
            >
              <LogoLoja loja={loja} tamanho={20} />
              {loja.nome}
            </span>
          )}
        </div>
        <input
          type="text"
          placeholder="Ex.: Compras Continente"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          className={`campo ${emFalta("loja") ? "ring-2 ring-amber-400" : ""}`}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="rotulo">Categoria</label>
          <select
            value={categoriaId}
            onChange={(e) => setCategoriaId(e.target.value === "" ? "" : Number(e.target.value))}
            className="campo"
          >
            <option value="">— Sem categoria —</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="rotulo">Quem pagou</label>
          <select
            value={membroId}
            onChange={(e) => setMembroId(e.target.value === "" ? "" : Number(e.target.value))}
            className="campo"
          >
            <option value="">— Ninguém —</option>
            {membros.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="rotulo">Data</label>
        <input
          type="date"
          value={data}
          onChange={(e) => setData(e.target.value)}
          className={`campo ${emFalta("data") ? "ring-2 ring-amber-400" : ""}`}
        />
      </div>

      {/* "Dividir por" (para "acertar contas") — só faz sentido em grupo. */}
      {!solo && membros.length > 0 && (
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="rotulo mb-0">Dividir por</label>
            <div className="flex gap-2 text-xs">
              <button
                type="button"
                className="text-marcatxt"
                onClick={() => setParticipantes(membros.map((m) => m.id))}
              >
                Todos
              </button>
              <span className="text-slate-600">·</span>
              <button type="button" className="text-slate-400" onClick={() => setParticipantes([])}>
                Nenhum
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {membros.map((m) => {
              const ativo = participantes.includes(m.id);
              return (
                <button
                  type="button"
                  key={m.id}
                  onClick={() => alternarParticipante(m.id)}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                    ativo
                      ? "border-transparent bg-marca-500 text-white"
                      : "border-linha/10 bg-noite-900/50 text-slate-300"
                  }`}
                >
                  {ativo ? "✓ " : ""}
                  {m.nome}
                </button>
              );
            })}
          </div>
          {(() => {
            const c = parseEurosParaCentimos(valor);
            if (c && participantes.length > 0) {
              const cada = Math.floor(c / participantes.length);
              return (
                <p className="mt-2 text-xs text-slate-400">
                  Cada pessoa: {(cada / 100).toLocaleString("pt-PT", { minimumFractionDigits: 2 })} €
                  {" "}({participantes.length}{" "}
                  {participantes.length === 1 ? "pessoa" : "pessoas"})
                </p>
              );
            }
            if (participantes.length === 0) {
              return (
                <p className="mt-2 text-xs text-slate-500">
                  Sem ninguém selecionado, esta despesa não entra no "acertar contas".
                </p>
              );
            }
            return null;
          })()}
        </div>
      )}

      {erro && (
        <p className="rounded-xl bg-red-500/10 border border-red-500/30 px-3 py-2 text-sm text-red-300">
          {erro}
        </p>
      )}

      <div className="flex gap-3 pt-1">
        <button className="botao-secundario flex-1" onClick={onFechar} disabled={aGuardar}>
          Cancelar
        </button>
        <button className="botao-primario flex-1" onClick={guardar} disabled={aGuardar}>
          {aGuardar ? "A guardar…" : editar ? "Guardar" : "Adicionar"}
        </button>
      </div>
    </div>
  );
}
