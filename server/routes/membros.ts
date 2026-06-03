import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";

export const membrosRouter = Router();

const MembroInput = z.object({
  nome: z.string().trim().min(1, "Nome obrigatório").max(40),
});

// GET /api/membros
membrosRouter.get("/", (_req, res) => {
  const linhas = db
    .prepare("SELECT id, nome FROM membros ORDER BY nome COLLATE NOCASE")
    .all();
  res.json(linhas);
});

// POST /api/membros
membrosRouter.post("/", (req, res) => {
  const parsed = MembroInput.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ erro: parsed.error.flatten() });
  }
  try {
    const info = db.prepare("INSERT INTO membros (nome) VALUES (?)").run(parsed.data.nome);
    const novo = db.prepare("SELECT id, nome FROM membros WHERE id = ?").get(info.lastInsertRowid);
    res.status(201).json(novo);
  } catch (e: any) {
    if (String(e.message).includes("UNIQUE")) {
      return res.status(409).json({ erro: "Já existe um membro com esse nome" });
    }
    throw e;
  }
});

// DELETE /api/membros/:id
membrosRouter.delete("/:id", (req, res) => {
  const id = Number(req.params.id);
  const info = db.prepare("DELETE FROM membros WHERE id = ?").run(id);
  if (info.changes === 0) return res.status(404).json({ erro: "Não encontrado" });
  res.status(204).end();
});
