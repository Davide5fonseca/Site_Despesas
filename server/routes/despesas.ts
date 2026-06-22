import { Router } from "express";
import { z } from "zod";
import pg from "pg";
import { q, um, tx, ah, pool } from "../db.js";
import { materializarFixas } from "../lib/fixas.js";

export const despesasRouter = Router();

const DespesaInput = z.object({
  valor_centimos: z.number().int().nonnegative(),
  descricao: z.string().trim().max(120).default(""),
  categoria_id: z.number().int().positive().nullable().optional(),
  membro_id: z.number().int().positive().nullable().optional(),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve ser YYYY-MM-DD"),
  origem: z.enum(["manual", "talao", "fixa"]).default("manual"),
  participantes: z.array(z.number().int().positive()).optional().default([]),
});

const SELECT_BASE = `
  SELECT
    d.id, d.valor_centimos, d.descricao, d.data, d.origem, d.criado_em,
    d.categoria_id, c.nome AS categoria_nome, c.cor AS categoria_cor,
    d.membro_id, m.nome AS membro_nome,
    COALESCE(
      (SELECT array_agg(dm.membro_id) FROM despesa_membros dm WHERE dm.despesa_id = d.id),
      ARRAY[]::int[]
    ) AS participantes
  FROM despesas d
  LEFT JOIN categorias c ON c.id = d.categoria_id
  LEFT JOIN membros    m ON m.id = d.membro_id
`;

// Filtra participantes para apenas membros da família.
async function participantesValidos(familiaId: number, ids: number[]): Promise<number[]> {
  if (!ids.length) return [];
  const linhas = await q<{ id: number }>("SELECT id FROM membros WHERE familia_id = $1", [familiaId]);
  const validos = new Set(linhas.map((m) => m.id));
  return [...new Set(ids)].filter((id) => validos.has(id));
}

// Garante que categoria/membro indicados pertencem à própria família.
async function validarPertenca(
  familiaId: number,
  categoriaId: number | null,
  membroId: number | null
): Promise<string | null> {
  if (categoriaId != null) {
    const ok = await um("SELECT 1 FROM categorias WHERE id = $1 AND familia_id = $2", [categoriaId, familiaId]);
    if (!ok) return "Categoria inválida para esta família.";
  }
  if (membroId != null) {
    const ok = await um("SELECT 1 FROM membros WHERE id = $1 AND familia_id = $2", [membroId, familiaId]);
    if (!ok) return "Membro inválido para esta família.";
  }
  return null;
}

async function gravarParticipantes(c: pg.PoolClient, despesaId: number, ids: number[]) {
  for (const mid of ids) {
    await c.query(
      "INSERT INTO despesa_membros (despesa_id, membro_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [despesaId, mid]
    );
  }
}

// GET /api/despesas?mes=YYYY-MM&categoria=ID
despesasRouter.get(
  "/",
  ah(async (req, res) => {
    const familiaId = (req as any).familiaId as number;
    const cond = ["d.familia_id = $1"];
    const params: any[] = [familiaId];
    let i = 2;

    const mes = req.query.mes as string | undefined;
    if (mes && /^\d{4}-\d{2}$/.test(mes)) {
      await materializarFixas(familiaId, mes); // gera as fixas deste mês, se faltar
      cond.push(`d.data LIKE $${i++}`);
      params.push(`${mes}-%`);
    }
    const categoria = req.query.categoria as string | undefined;
    if (categoria && /^\d+$/.test(categoria)) {
      cond.push(`d.categoria_id = $${i++}`);
      params.push(Number(categoria));
    }

    const linhas = await q(
      `${SELECT_BASE} WHERE ${cond.join(" AND ")} ORDER BY d.data DESC, d.id DESC`,
      params
    );
    res.json(linhas);
  })
);

// POST /api/despesas
despesasRouter.post(
  "/",
  ah(async (req, res) => {
    const familiaId = (req as any).familiaId as number;
    const parsed = DespesaInput.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ erro: parsed.error.flatten() });
    const d = parsed.data;
    const parts = await participantesValidos(familiaId, d.participantes);
    const erroPert = await validarPertenca(familiaId, d.categoria_id ?? null, d.membro_id ?? null);
    if (erroPert) return res.status(400).json({ erro: erroPert });

    const nova = await tx(async (c) => {
      const id = (
        await c.query<{ id: number }>(
          `INSERT INTO despesas (familia_id, valor_centimos, descricao, categoria_id, membro_id, data, origem)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
          [familiaId, d.valor_centimos, d.descricao, d.categoria_id ?? null, d.membro_id ?? null, d.data, d.origem]
        )
      ).rows[0].id;
      await gravarParticipantes(c, id, parts);
      return (await c.query(`${SELECT_BASE} WHERE d.id = $1`, [id])).rows[0];
    });
    res.status(201).json(nova);
  })
);

// PUT /api/despesas/:id
despesasRouter.put(
  "/:id",
  ah(async (req, res) => {
    const familiaId = (req as any).familiaId as number;
    const id = Number(req.params.id);
    const parsed = DespesaInput.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ erro: parsed.error.flatten() });
    const d = parsed.data;
    const parts = await participantesValidos(familiaId, d.participantes);
    const erroPert = await validarPertenca(familiaId, d.categoria_id ?? null, d.membro_id ?? null);
    if (erroPert) return res.status(400).json({ erro: erroPert });

    const atualizada = await tx(async (c) => {
      const upd = await c.query(
        `UPDATE despesas
           SET valor_centimos = $1, descricao = $2, categoria_id = $3, membro_id = $4, data = $5, origem = $6
         WHERE id = $7 AND familia_id = $8`,
        [d.valor_centimos, d.descricao, d.categoria_id ?? null, d.membro_id ?? null, d.data, d.origem, id, familiaId]
      );
      if (upd.rowCount === 0) return null;
      await c.query("DELETE FROM despesa_membros WHERE despesa_id = $1", [id]);
      await gravarParticipantes(c, id, parts);
      return (await c.query(`${SELECT_BASE} WHERE d.id = $1`, [id])).rows[0];
    });

    if (!atualizada) return res.status(404).json({ erro: "Não encontrada" });
    res.json(atualizada);
  })
);

// DELETE /api/despesas/:id
despesasRouter.delete(
  "/:id",
  ah(async (req, res) => {
    const familiaId = (req as any).familiaId as number;
    const id = Number(req.params.id);
    const r = await pool.query("DELETE FROM despesas WHERE id = $1 AND familia_id = $2", [id, familiaId]);
    if (r.rowCount === 0) return res.status(404).json({ erro: "Não encontrada" });
    res.status(204).end();
  })
);
