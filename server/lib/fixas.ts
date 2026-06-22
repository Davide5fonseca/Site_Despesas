import { q, um, tx } from "../db.js";

const pad = (n: number) => String(n).padStart(2, "0");

function mesAtual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

interface Fixa {
  id: number;
  valor_centimos: number;
  descricao: string;
  categoria_id: number | null;
  membro_id: number | null;
  dia: number;
  participantes: number[];
  desde: string; // 'YYYY-MM' (mês de criação)
}

/**
 * Garante que as despesas fixas (ativas) da família estão geradas para `mes`.
 * Idempotente: só gera entre o mês de criação e o mês atual, e nunca duplica
 * (reserva o slot em geracoes_fixas antes de criar a despesa).
 */
export async function materializarFixas(familiaId: number, mes: string): Promise<void> {
  if (!/^\d{4}-\d{2}$/.test(mes)) return;
  if (mes > mesAtual()) return; // não cria despesas de meses futuros

  const fixas = await q<Fixa>(
    `SELECT id, valor_centimos, descricao, categoria_id, membro_id, dia, participantes,
            to_char(criado_em, 'YYYY-MM') AS desde
       FROM despesas_fixas
      WHERE familia_id = $1 AND ativa = true`,
    [familiaId]
  );

  for (const f of fixas) {
    if (mes < f.desde) continue; // antes de a fixa existir

    // Pré-verificação rápida (evita abrir transação no caso comum)
    const ja = await um("SELECT 1 FROM geracoes_fixas WHERE despesa_fixa_id = $1 AND mes = $2", [f.id, mes]);
    if (ja) continue;

    await tx(async (c) => {
      // Reserva o slot; se outro pedido já o fez, sai sem criar nada.
      const reserva = await c.query(
        "INSERT INTO geracoes_fixas (despesa_fixa_id, mes) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING despesa_fixa_id",
        [f.id, mes]
      );
      if (reserva.rowCount === 0) return;

      const [ano, m] = mes.split("-").map(Number);
      const ultimoDia = new Date(ano, m, 0).getDate();
      const dia = Math.min(Math.max(f.dia, 1), ultimoDia);
      const data = `${mes}-${pad(dia)}`;

      const ins = await c.query<{ id: number }>(
        `INSERT INTO despesas (familia_id, valor_centimos, descricao, categoria_id, membro_id, data, origem, despesa_fixa_id)
         VALUES ($1, $2, $3, $4, $5, $6, 'fixa', $7) RETURNING id`,
        [familiaId, f.valor_centimos, f.descricao, f.categoria_id, f.membro_id, data, f.id]
      );
      const despesaId = ins.rows[0].id;

      for (const mid of f.participantes || []) {
        await c.query(
          "INSERT INTO despesa_membros (despesa_id, membro_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
          [despesaId, mid]
        );
      }
      await c.query("UPDATE geracoes_fixas SET despesa_id = $1 WHERE despesa_fixa_id = $2 AND mes = $3", [
        despesaId,
        f.id,
        mes,
      ]);
    });
  }
}

export { mesAtual };
