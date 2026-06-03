import { useState } from "react";
import { api, Categoria, Membro, Origem } from "../api/client";
import { hojeISO, parseEurosParaCentimos } from "../lib/format";

export interface DadosIniciais {
  id?: number;
  valorTexto?: string; // ex.: "12,50"
  descricao?: string;
  categoria_id?: number | null;
  membro_id?: number | null;
  data?: string; // YYYY-MM-DD
  origem?: Origem;
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

export default function FormDespesa({ categorias, membros, inicial, talao, onGuardado, onFechar }: Props) {
  const [valor, setValor] = useState(inicial?.valorTexto ?? "");
  const [descricao, setDescricao] = useState(inicial?.descricao ?? "");
  const [categoriaId, setCategoriaId] = useState<number | "">(inicial?.categoria_id ?? "");
  const [membroId, setMembroId] = useState<number | "">(inicial?.membro_id ?? "");
  const [data, setData] = useState(inicial?.data ?? hojeISO());
  const [aGuardar, setAGuardar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const editar = inicial?.id != null;
  const emFalta = (campo: string) => talao?.camposEmFalta.includes(campo);

  async function guardar() {
    setErro(null);
    const centimos = parseEurosParaCentimos(valor);
    if (centimos === null) {
      setErro("Indica um valor válido (ex.: 12,50).");
      return;
    }
    setAGuardar(true);
    try {
      const payload = {
        valor_centimos: centimos,
        descricao: descricao.trim(),
        categoria_id: categoriaId === "" ? null : Number(categoriaId),
        membro_id: membroId === "" ? null : Number(membroId),
        data,
        origem: inicial?.origem ?? "manual",
      };
      if (editar) await api.editarDespesa(inicial!.id!, payload);
      else await api.criarDespesa(payload);
      onGuardado();
    } catch (e: any) {
      setErro(e?.message || "Não foi possível guardar.");
    } finally {
      setAGuardar(false);
    }
  }

  return (
    <div className="space-y-4">
      {talao && (
        <div className={`rounded-2xl border px-4 py-3 text-sm ${corConfianca[talao.confianca]}`}>
          <p className="font-semibold">
            Talão lido por IA · confiança {talao.confianca}
          </p>
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
        <label className="rotulo">Descrição</label>
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

      {membros.length === 0 && (
        <p className="text-xs text-slate-500">
          Dica: adiciona membros da casa em <span className="text-slate-300">Definições</span> para
          associar quem pagou.
        </p>
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
