import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";

export const despesasRouter = Router();

const DespesaInput = z.object({
  valor_centimos: z.number().int().nonnegative(),
  descricao: z.string().trim().max(120).default(""),
  categoria_id: z.number().int().positive().nullable().optional(),
  membro_id: z.number().int().positive().nullable().optional(),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve ser YYYY-MM-DD"),
  origem: z.enum(["manual", "talao"]).default("manual"),
});

const SELECT_BASE = `
  SELECT
    d.id, d.valor_centimos, d.descricao, d.data, d.origem, d.criado_em,
    d.categoria_id, c.nome AS categoria_nome, c.cor AS categoria_cor,
    d.membro_id, m.nome AS membro_nome
  FROM despesas d
  LEFT JOIN categorias c ON c.id = d.categoria_id
  LEFT JOIN membros    m ON m.id = d.membro_id
`;

// GET /api/despesas?mes=YYYY-MM&categoria=ID
despesasRouter.get("/", (req, res) => {
  const familiaId = (req as any).familiaId as number;
  const condicoes: string[] = ["d.familia_id = ?"];
  const params: any[] = [familiaId];

  const mes = req.query.mes as string | undefined;
  if (mes && /^\d{4}-\d{2}$/.test(mes)) {
    condicoes.push("d.data LIKE ?");
    params.push(`${mes}-%`);
  }

  const categoria = req.query.categoria as string | undefined;
  if (categoria && /^\d+$/.test(categoria)) {
    condicoes.push("d.categoria_id = ?");
    params.push(Number(categoria));
  }

  const linhas = db
    .prepare(`${SELECT_BASE} WHERE ${condicoes.join(" AND ")} ORDER BY d.data DESC, d.id DESC`)
    .all(...params);

  res.json(linhas);
});

// POST /api/despesas
despesasRouter.post("/", (req, res) => {
  const familiaId = (req as any).familiaId as number;
  const parsed = DespesaInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ erro: parsed.error.flatten() });
  const d = parsed.data;
  const info = db
    .prepare(
      `INSERT INTO despesas (familia_id, valor_centimos, descricao, categoria_id, membro_id, data, origem)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(familiaId, d.valor_centimos, d.descricao, d.categoria_id ?? null, d.membro_id ?? null, d.data, d.origem);

  const nova = db.prepare(`${SELECT_BASE} WHERE d.id = ?`).get(info.lastInsertRowid);
  res.status(201).json(nova);
});

// PUT /api/despesas/:id
despesasRouter.put("/:id", (req, res) => {
  const familiaId = (req as any).familiaId as number;
  const id = Number(req.params.id);
  const parsed = DespesaInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ erro: parsed.error.flatten() });
  const d = parsed.data;
  const info = db
    .prepare(
      `UPDATE despesas
         SET valor_centimos = ?, descricao = ?, categoria_id = ?, membro_id = ?, data = ?, origem = ?
       WHERE id = ? AND familia_id = ?`
    )
    .run(d.valor_centimos, d.descricao, d.categoria_id ?? null, d.membro_id ?? null, d.data, d.origem, id, familiaId);

  if (info.changes === 0) return res.status(404).json({ erro: "Não encontrada" });
  const atualizada = db.prepare(`${SELECT_BASE} WHERE d.id = ?`).get(id);
  res.json(atualizada);
});

// DELETE /api/despesas/:id
despesasRouter.delete("/:id", (req, res) => {
  const familiaId = (req as any).familiaId as number;
  const id = Number(req.params.id);
  const info = db
    .prepare("DELETE FROM despesas WHERE id = ? AND familia_id = ?")
    .run(id, familiaId);
  if (info.changes === 0) return res.status(404).json({ erro: "Não encontrada" });
  res.status(204).end();
});
