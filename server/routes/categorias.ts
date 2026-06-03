import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";

export const categoriasRouter = Router();

const CategoriaInput = z.object({
  nome: z.string().trim().min(1, "Nome obrigatório").max(40),
  cor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Cor deve ser hex #rrggbb")
    .default("#64748b"),
});

// GET /api/categorias
categoriasRouter.get("/", (req, res) => {
  const familiaId = (req as any).familiaId as number;
  const linhas = db
    .prepare(
      "SELECT id, nome, cor FROM categorias WHERE familia_id = ? ORDER BY nome COLLATE NOCASE"
    )
    .all(familiaId);
  res.json(linhas);
});

// POST /api/categorias
categoriasRouter.post("/", (req, res) => {
  const familiaId = (req as any).familiaId as number;
  const parsed = CategoriaInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ erro: parsed.error.flatten() });
  try {
    const info = db
      .prepare("INSERT INTO categorias (familia_id, nome, cor) VALUES (?, ?, ?)")
      .run(familiaId, parsed.data.nome, parsed.data.cor);
    const nova = db
      .prepare("SELECT id, nome, cor FROM categorias WHERE id = ?")
      .get(info.lastInsertRowid);
    res.status(201).json(nova);
  } catch (e: any) {
    if (String(e.message).includes("UNIQUE")) {
      return res.status(409).json({ erro: "Já existe uma categoria com esse nome" });
    }
    throw e;
  }
});

// DELETE /api/categorias/:id
categoriasRouter.delete("/:id", (req, res) => {
  const familiaId = (req as any).familiaId as number;
  const id = Number(req.params.id);
  const info = db
    .prepare("DELETE FROM categorias WHERE id = ? AND familia_id = ?")
    .run(id, familiaId);
  if (info.changes === 0) return res.status(404).json({ erro: "Não encontrada" });
  res.status(204).end();
});
