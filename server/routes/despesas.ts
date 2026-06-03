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
  // Quem divide o custo (para "acertar contas"). Vazio = não entra nos saldos.
  participantes: z.array(z.number().int().positive()).optional().default([]),
});

const SELECT_BASE = `
  SELECT
    d.id, d.valor_centimos, d.descricao, d.data, d.origem, d.criado_em,
    d.categoria_id, c.nome AS categoria_nome, c.cor AS categoria_cor,
    d.membro_id, m.nome AS membro_nome,
    (SELECT group_concat(dm.membro_id) FROM despesa_membros dm WHERE dm.despesa_id = d.id) AS participantes_csv
  FROM despesas d
  LEFT JOIN categorias c ON c.id = d.categoria_id
  LEFT JOIN membros    m ON m.id = d.membro_id
`;

// Converte participantes_csv ("1,3,4") em array de números.
function comParticipantes(row: any) {
  const { participantes_csv, ...resto } = row;
  return {
    ...resto,
    participantes: participantes_csv
      ? String(participantes_csv).split(",").map(Number)
      : [],
  };
}

// Filtra a lista de participantes para apenas os membros que pertencem à família.
function participantesValidos(familiaId: number, ids: number[]): number[] {
  if (!ids.length) return [];
  const validos = new Set(
    (db.prepare("SELECT id FROM membros WHERE familia_id = ?").all(familiaId) as Array<{
      id: number;
    }>).map((m) => m.id)
  );
  return [...new Set(ids)].filter((id) => validos.has(id));
}

// Prepara a inserção de participantes (lazy: só quando a tabela já existe).
function gravarParticipantes(despesaId: number, ids: number[]) {
  const stmt = db.prepare(
    "INSERT OR IGNORE INTO despesa_membros (despesa_id, membro_id) VALUES (?, ?)"
  );
  for (const mid of ids) stmt.run(despesaId, mid);
}

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
    .all(...params) as any[];

  res.json(linhas.map(comParticipantes));
});

// POST /api/despesas
despesasRouter.post("/", (req, res) => {
  const familiaId = (req as any).familiaId as number;
  const parsed = DespesaInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ erro: parsed.error.flatten() });
  const d = parsed.data;
  const parts = participantesValidos(familiaId, d.participantes);

  const criar = db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO despesas (familia_id, valor_centimos, descricao, categoria_id, membro_id, data, origem)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(familiaId, d.valor_centimos, d.descricao, d.categoria_id ?? null, d.membro_id ?? null, d.data, d.origem);
    const id = Number(info.lastInsertRowid);
    gravarParticipantes(id, parts);
    return id;
  });
  const id = criar();

  const nova = db.prepare(`${SELECT_BASE} WHERE d.id = ?`).get(id);
  res.status(201).json(comParticipantes(nova));
});

// PUT /api/despesas/:id
despesasRouter.put("/:id", (req, res) => {
  const familiaId = (req as any).familiaId as number;
  const id = Number(req.params.id);
  const parsed = DespesaInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ erro: parsed.error.flatten() });
  const d = parsed.data;
  const parts = participantesValidos(familiaId, d.participantes);

  const atualizar = db.transaction(() => {
    const info = db
      .prepare(
        `UPDATE despesas
           SET valor_centimos = ?, descricao = ?, categoria_id = ?, membro_id = ?, data = ?, origem = ?
         WHERE id = ? AND familia_id = ?`
      )
      .run(d.valor_centimos, d.descricao, d.categoria_id ?? null, d.membro_id ?? null, d.data, d.origem, id, familiaId);
    if (info.changes === 0) return false;
    db.prepare("DELETE FROM despesa_membros WHERE despesa_id = ?").run(id);
    gravarParticipantes(id, parts);
    return true;
  });

  if (!atualizar()) return res.status(404).json({ erro: "Não encontrada" });
  const atualizada = db.prepare(`${SELECT_BASE} WHERE d.id = ?`).get(id);
  res.json(comParticipantes(atualizada));
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
