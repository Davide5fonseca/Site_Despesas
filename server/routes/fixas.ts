import { Router } from "express";
import { z } from "zod";
import { q, um, ah, pool } from "../db.js";
import { materializarFixas, mesAtual } from "../lib/fixas.js";

export const fixasRouter = Router();

const FixaInput = z.object({
  valor_centimos: z.number().int().nonnegative(),
  descricao: z.string().trim().max(120).default(""),
  categoria_id: z.number().int().positive().nullable().optional(),
  membro_id: z.number().int().positive().nullable().optional(),
  dia: z.number().int().min(1).max(31),
  participantes: z.array(z.number().int().positive()).optional().default([]),
  ativa: z.boolean().optional().default(true),
});

const SELECT_BASE = `
  SELECT
    f.id, f.valor_centimos, f.descricao, f.dia, f.ativa, f.participantes,
    f.categoria_id, c.nome AS categoria_nome, c.cor AS categoria_cor,
    f.membro_id, m.nome AS membro_nome
  FROM despesas_fixas f
  LEFT JOIN categorias c ON c.id = f.categoria_id
  LEFT JOIN membros    m ON m.id = f.membro_id
`;

// Devolve só os IDs válidos (categoria/membro/participantes da família).
async function validar(familiaId: number, categoriaId: number | null, membroId: number | null, participantes: number[]) {
  if (categoriaId != null) {
    const ok = await um("SELECT 1 FROM categorias WHERE id = $1 AND familia_id = $2", [categoriaId, familiaId]);
    if (!ok) return { erro: "Categoria inválida para esta família." as string, parts: [] as number[] };
  }
  if (membroId != null) {
    const ok = await um("SELECT 1 FROM membros WHERE id = $1 AND familia_id = $2", [membroId, familiaId]);
    if (!ok) return { erro: "Membro inválido para esta família.", parts: [] as number[] };
  }
  const membros = new Set(
    (await q<{ id: number }>("SELECT id FROM membros WHERE familia_id = $1", [familiaId])).map((r) => r.id)
  );
  const parts = [...new Set(participantes)].filter((id) => membros.has(id));
  return { erro: null as string | null, parts };
}

// GET /api/fixas
fixasRouter.get(
  "/",
  ah(async (req, res) => {
    const familiaId = (req as any).familiaId as number;
    const linhas = await q(`${SELECT_BASE} WHERE f.familia_id = $1 ORDER BY f.dia, lower(f.descricao)`, [familiaId]);
    res.json(linhas);
  })
);

// POST /api/fixas
fixasRouter.post(
  "/",
  ah(async (req, res) => {
    const familiaId = (req as any).familiaId as number;
    const parsed = FixaInput.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ erro: parsed.error.flatten() });
    const d = parsed.data;
    const v = await validar(familiaId, d.categoria_id ?? null, d.membro_id ?? null, d.participantes);
    if (v.erro) return res.status(400).json({ erro: v.erro });

    const info = await um<{ id: number }>(
      `INSERT INTO despesas_fixas (familia_id, valor_centimos, descricao, categoria_id, membro_id, dia, participantes, ativa)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [familiaId, d.valor_centimos, d.descricao, d.categoria_id ?? null, d.membro_id ?? null, d.dia, v.parts, d.ativa]
    );
    // Gera já a despesa do mês atual (se a fixa estiver ativa).
    if (d.ativa) await materializarFixas(familiaId, mesAtual());

    const nova = await um(`${SELECT_BASE} WHERE f.id = $1`, [info!.id]);
    res.status(201).json(nova);
  })
);

// PUT /api/fixas/:id
fixasRouter.put(
  "/:id",
  ah(async (req, res) => {
    const familiaId = (req as any).familiaId as number;
    const id = Number(req.params.id);
    const parsed = FixaInput.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ erro: parsed.error.flatten() });
    const d = parsed.data;
    const v = await validar(familiaId, d.categoria_id ?? null, d.membro_id ?? null, d.participantes);
    if (v.erro) return res.status(400).json({ erro: v.erro });

    const upd = await pool.query(
      `UPDATE despesas_fixas
         SET valor_centimos = $1, descricao = $2, categoria_id = $3, membro_id = $4, dia = $5, participantes = $6, ativa = $7
       WHERE id = $8 AND familia_id = $9`,
      [d.valor_centimos, d.descricao, d.categoria_id ?? null, d.membro_id ?? null, d.dia, v.parts, d.ativa, id, familiaId]
    );
    if (upd.rowCount === 0) return res.status(404).json({ erro: "Não encontrada" });
    const atualizada = await um(`${SELECT_BASE} WHERE f.id = $1`, [id]);
    res.json(atualizada);
  })
);

// DELETE /api/fixas/:id  (não apaga as despesas já geradas — só o modelo)
fixasRouter.delete(
  "/:id",
  ah(async (req, res) => {
    const familiaId = (req as any).familiaId as number;
    const id = Number(req.params.id);
    const r = await pool.query("DELETE FROM despesas_fixas WHERE id = $1 AND familia_id = $2", [id, familiaId]);
    if (r.rowCount === 0) return res.status(404).json({ erro: "Não encontrada" });
    res.status(204).end();
  })
);
