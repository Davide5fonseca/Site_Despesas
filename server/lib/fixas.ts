import { q, tx } from "../db.js";
import { deslocarMes, mesAtual, RE_MES } from "./tempo.js";

const pad = (n: number) => String(n).padStart(2, "0");

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
 * Garante que as despesas fixas (ativas) da família estão geradas em todos os
 * meses desde a sua criação até `mes` (limitado ao mês atual — nunca cria
 * despesas futuras). Assim um mês em que ninguém abriu a app não fica em falta
 * nos totais, no "acertar contas" nem na evolução.
 *
 * Idempotente: reserva o slot em geracoes_fixas antes de criar a despesa, por
 * isso pedidos concorrentes nunca duplicam. Um mês cuja despesa gerada foi
 * apagada à mão não volta a ser gerado (o slot continua reservado).
 */
export async function materializarFixas(familiaId: number, mes: string): Promise<void> {
  if (!RE_MES.test(mes)) return;
  const agora = mesAtual();
  const ate = mes > agora ? agora : mes;

  const fixas = await q<Fixa>(
    `SELECT id, valor_centimos, descricao, categoria_id, membro_id, dia, participantes,
            to_char(criado_em AT TIME ZONE $2, 'YYYY-MM') AS desde
       FROM despesas_fixas
      WHERE familia_id = $1 AND ativa = true`,
    [familiaId, process.env.APP_TZ || "Europe/Lisbon"]
  );
  if (!fixas.length) return;

  // Meses já gerados (uma só query para todas as fixas).
  const feitas = await q<{ despesa_fixa_id: number; mes: string }>(
    "SELECT despesa_fixa_id, mes FROM geracoes_fixas WHERE despesa_fixa_id = ANY($1::int[])",
    [fixas.map((f) => f.id)]
  );
  const jaFeito = new Set(feitas.map((g) => `${g.despesa_fixa_id}|${g.mes}`));

  // Participantes só podem ser membros que ainda existem (um membro apagado
  // continuaria no array e rebentava a FK de despesa_membros).
  const membros = new Set(
    (await q<{ id: number }>("SELECT id FROM membros WHERE familia_id = $1", [familiaId])).map((m) => m.id)
  );

  for (const f of fixas) {
    for (let m = f.desde; m <= ate; m = deslocarMes(m, 1)) {
      if (jaFeito.has(`${f.id}|${m}`)) continue;
      await gerarMes(familiaId, f, m, membros);
    }
  }
}

async function gerarMes(familiaId: number, f: Fixa, mes: string, membros: Set<number>) {
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

    for (const mid of new Set(f.participantes || [])) {
      if (!membros.has(mid)) continue;
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

export { mesAtual };
