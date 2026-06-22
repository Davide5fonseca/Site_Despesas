import { Router } from "express";
import { z } from "zod";
import { q, um, ah, ERRO_UNICO } from "../db.js";

export const membrosRouter = Router();

const MembroInput = z.object({
  nome: z.string().trim().min(1, "Nome obrigatório").max(40),
});

// GET /api/membros
membrosRouter.get(
  "/",
  ah(async (req, res) => {
    const familiaId = (req as any).familiaId as number;
    const linhas = await q(
      "SELECT id, nome FROM membros WHERE familia_id = $1 ORDER BY lower(nome)",
      [familiaId]
    );
    res.json(linhas);
  })
);

// POST /api/membros
membrosRouter.post(
  "/",
  ah(async (req, res) => {
    const familiaId = (req as any).familiaId as number;
    const parsed = MembroInput.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ erro: parsed.error.flatten() });
    try {
      const novo = await um(
        "INSERT INTO membros (familia_id, nome) VALUES ($1, $2) RETURNING id, nome",
        [familiaId, parsed.data.nome]
      );
      res.status(201).json(novo);
    } catch (e: any) {
      if (e?.code === ERRO_UNICO) {
        return res.status(409).json({ erro: "Já existe um membro com esse nome" });
      }
      throw e;
    }
  })
);

// PUT /api/membros/:id  (renomear)
membrosRouter.put(
  "/:id",
  ah(async (req, res) => {
    const familiaId = (req as any).familiaId as number;
    const id = Number(req.params.id);
    const parsed = MembroInput.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ erro: parsed.error.flatten() });
    try {
      const atualizado = await um(
        "UPDATE membros SET nome = $1 WHERE id = $2 AND familia_id = $3 RETURNING id, nome",
        [parsed.data.nome, id, familiaId]
      );
      if (!atualizado) return res.status(404).json({ erro: "Não encontrado" });
      res.json(atualizado);
    } catch (e: any) {
      if (e?.code === ERRO_UNICO) {
        return res.status(409).json({ erro: "Já existe um membro com esse nome" });
      }
      throw e;
    }
  })
);

// DELETE /api/membros/:id
membrosRouter.delete(
  "/:id",
  ah(async (req, res) => {
    const familiaId = (req as any).familiaId as number;
    const id = Number(req.params.id);
    const apagado = await um(
      "DELETE FROM membros WHERE id = $1 AND familia_id = $2 RETURNING id",
      [id, familiaId]
    );
    if (!apagado) return res.status(404).json({ erro: "Não encontrado" });
    res.status(204).end();
  })
);
