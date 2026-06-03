import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";

export const despesasRouter = Router();

const DespesaInput = z.object({
  // valor em cêntimos (inteiro) — fonte de verdade, sem vírgula flutuante
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
  const condicoes: string[] = [];
  const params: any[] = [];

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

  const where = condicoes.length ? `WHERE ${condicoes.join(" AND ")}` : "";
  const linhas = db
    .prepare(`${SELECT_BASE} ${where} ORDER BY d.data DESC, d.id DESC`)
    .all(...params);

  res.json(linhas);
});

// POST /api/despesas
despesasRouter.post("/", (req, res) => {
  const parsed = DespesaInput.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ erro: parsed.error.flatten() });
  }
  const d = parsed.data;
  const info = db
    .prepare(
      `INSERT INTO despesas (valor_centimos, descricao, categoria_id, membro_id, data, origem)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(d.valor_centimos, d.descricao, d.categoria_id ?? null, d.membro_id ?? null, d.data, d.origem);

  const nova = db.prepare(`${SELECT_BASE} WHERE d.id = ?`).get(info.lastInsertRowid);
  res.status(201).json(nova);
});

// PUT /api/despesas/:id
despesasRouter.put("/:id", (req, res) => {
  const id = Number(req.params.id);
  const parsed = DespesaInput.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ erro: parsed.error.flatten() });
  }
  const d = parsed.data;
  const info = db
    .prepare(
      `UPDATE despesas
         SET valor_centimos = ?, descricao = ?, categoria_id = ?, membro_id = ?, data = ?, origem = ?
       WHERE id = ?`
    )
    .run(d.valor_centimos, d.descricao, d.categoria_id ?? null, d.membro_id ?? null, d.data, d.origem, id);

  if (info.changes === 0) return res.status(404).json({ erro: "Não encontrada" });
  const atualizada = db.prepare(`${SELECT_BASE} WHERE d.id = ?`).get(id);
  res.json(atualizada);
});

// DELETE /api/despesas/:id
despesasRouter.delete("/:id", (req, res) => {
  const id = Number(req.params.id);
  const info = db.prepare("DELETE FROM despesas WHERE id = ?").run(id);
  if (info.changes === 0) return res.status(404).json({ erro: "Não encontrada" });
  res.status(204).end();
});
