import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";

export const membrosRouter = Router();

const MembroInput = z.object({
  nome: z.string().trim().min(1, "Nome obrigatório").max(40),
});

// GET /api/membros
membrosRouter.get("/", (req, res) => {
  const familiaId = (req as any).familiaId as number;
  const linhas = db
    .prepare("SELECT id, nome FROM membros WHERE familia_id = ? ORDER BY nome COLLATE NOCASE")
    .all(familiaId);
  res.json(linhas);
});

// POST /api/membros
membrosRouter.post("/", (req, res) => {
  const familiaId = (req as any).familiaId as number;
  const parsed = MembroInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ erro: parsed.error.flatten() });
  try {
    const info = db
      .prepare("INSERT INTO membros (familia_id, nome) VALUES (?, ?)")
      .run(familiaId, parsed.data.nome);
    const novo = db.prepare("SELECT id, nome FROM membros WHERE id = ?").get(info.lastInsertRowid);
    res.status(201).json(novo);
  } catch (e: any) {
    if (String(e.message).includes("UNIQUE")) {
      return res.status(409).json({ erro: "Já existe um membro com esse nome" });
    }
    throw e;
  }
});

// PUT /api/membros/:id  (renomear)
membrosRouter.put("/:id", (req, res) => {
  const familiaId = (req as any).familiaId as number;
  const id = Number(req.params.id);
  const parsed = MembroInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ erro: parsed.error.flatten() });
  try {
    const info = db
      .prepare("UPDATE membros SET nome = ? WHERE id = ? AND familia_id = ?")
      .run(parsed.data.nome, id, familiaId);
    if (info.changes === 0) return res.status(404).json({ erro: "Não encontrado" });
    const atualizado = db.prepare("SELECT id, nome FROM membros WHERE id = ?").get(id);
    res.json(atualizado);
  } catch (e: any) {
    if (String(e.message).includes("UNIQUE")) {
      return res.status(409).json({ erro: "Já existe um membro com esse nome" });
    }
    throw e;
  }
});

// DELETE /api/membros/:id
membrosRouter.delete("/:id", (req, res) => {
  const familiaId = (req as any).familiaId as number;
  const id = Number(req.params.id);
  const info = db
    .prepare("DELETE FROM membros WHERE id = ? AND familia_id = ?")
    .run(id, familiaId);
  if (info.changes === 0) return res.status(404).json({ erro: "Não encontrado" });
  res.status(204).end();
});
