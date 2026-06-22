import { useState } from "react";
import { api, Categoria, DespesaFixa, Membro } from "../api/client";
import { formatarNumero, parseEurosParaCentimos } from "../lib/format";

interface Props {
  categorias: Categoria[];
  membros: Membro[];
  inicial?: DespesaFixa; // presente = editar
  onGuardado: () => void;
  onFechar: () => void;
}

export default function FormFixa({ categorias, membros, inicial, onGuardado, onFechar }: Props) {
  const [valor, setValor] = useState(inicial ? formatarNumero(inicial.valor_centimos) : "");
  const [descricao, setDescricao] = useState(inicial?.descricao ?? "");
  const [categoriaId, setCategoriaId] = useState<number | "">(inicial?.categoria_id ?? "");
  const [membroId, setMembroId] = useState<number | "">(inicial?.membro_id ?? "");
  const [dia, setDia] = useState<number>(inicial?.dia ?? 1);
  const [participantes, setParticipantes] = useState<number[]>(
    inicial?.participantes ?? membros.map((m) => m.id)
  );
  const [ativa, setAtiva] = useState<boolean>(inicial?.ativa ?? true);
  const [aGuardar, setAGuardar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const editar = inicial != null;
  const alternar = (id: number) =>
    setParticipantes((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  async function guardar() {
    setErro(null);
    const centimos = parseEurosParaCentimos(valor);
    if (centimos === null) return setErro("Indica um valor válido (ex.: 7,99).");
    setAGuardar(true);
    try {
      const payload = {
        valor_centimos: centimos,
        descricao: descricao.trim(),
        categoria_id: categoriaId === "" ? null : Number(categoriaId),
        membro_id: membroId === "" ? null : Number(membroId),
        dia: Math.min(Math.max(Math.round(dia) || 1, 1), 31),
        participantes,
        ativa,
      };
      if (editar) await api.editarFixa(inicial!.id, payload);
      else await api.criarFixa(payload);
      onGuardado();
    } catch (e: any) {
      setErro(e?.message || "Não foi possível guardar.");
    } finally {
      setAGuardar(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="rotulo">Valor (€)</label>
        <input
          type="text"
          inputMode="decimal"
          placeholder="0,00"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          className="campo text-2xl font-bold"
          autoFocus={!editar}
        />
      </div>

      <div>
        <label className="rotulo">Descrição</label>
        <input
          type="text"
          placeholder="Ex.: Netflix, Renda, Ginásio"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          className="campo"
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
          <label className="rotulo">Dia do mês</label>
          <input
            type="number"
            min={1}
            max={31}
            value={dia}
            onChange={(e) => setDia(Number(e.target.value))}
            className="campo"
          />
        </div>
      </div>

      <div>
        <label className="rotulo">Quem paga</label>
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

      {membros.length > 0 && (
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="rotulo mb-0">Dividir por</label>
            <div className="flex gap-2 text-xs">
              <button type="button" className="text-marcatxt" onClick={() => setParticipantes(membros.map((m) => m.id))}>
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
              const on = participantes.includes(m.id);
              return (
                <button
                  type="button"
                  key={m.id}
                  onClick={() => alternar(m.id)}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                    on ? "border-transparent bg-marca-500 text-white" : "border-linha/10 bg-noite-900/50 text-slate-300"
                  }`}
                >
                  {on ? "✓ " : ""}
                  {m.nome}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <label className="flex items-center justify-between rounded-2xl bg-noite-900/50 px-4 py-3">
        <span className="text-sm font-medium text-slate-200">Ativa (gera todos os meses)</span>
        <input type="checkbox" checked={ativa} onChange={(e) => setAtiva(e.target.checked)} className="h-5 w-5 accent-marca-500" />
      </label>

      {erro && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{erro}</p>
      )}

      <div className="flex gap-3 pt-1">
        <button className="botao-secundario flex-1" onClick={onFechar} disabled={aGuardar}>
          Cancelar
        </button>
        <button className="botao-primario flex-1" onClick={guardar} disabled={aGuardar}>
          {aGuardar ? "A guardar…" : editar ? "Guardar" : "Criar fixa"}
        </button>
      </div>
    </div>
  );
}
