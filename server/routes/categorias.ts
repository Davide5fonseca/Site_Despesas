import { Router } from "express";
import { z } from "zod";
import { q, um, ah, ERRO_UNICO } from "../db.js";

export const categoriasRouter = Router();

const CategoriaInput = z.object({
  nome: z.string().trim().min(1, "Nome obrigatório").max(40),
  cor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Cor deve ser hex #rrggbb")
    .default("#64748b"),
});

// GET /api/categorias
categoriasRouter.get(
  "/",
  ah(async (req, res) => {
    const familiaId = (req as any).familiaId as number;
    const linhas = await q(
      "SELECT id, nome, cor FROM categorias WHERE familia_id = $1 ORDER BY lower(nome)",
      [familiaId]
    );
    res.json(linhas);
  })
);

// POST /api/categorias
categoriasRouter.post(
  "/",
  ah(async (req, res) => {
    const familiaId = (req as any).familiaId as number;
    const parsed = CategoriaInput.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ erro: parsed.error.flatten() });
    try {
      const nova = await um(
        "INSERT INTO categorias (familia_id, nome, cor) VALUES ($1, $2, $3) RETURNING id, nome, cor",
        [familiaId, parsed.data.nome, parsed.data.cor]
      );
      res.status(201).json(nova);
    } catch (e: any) {
      if (e?.code === ERRO_UNICO) {
        return res.status(409).json({ erro: "Já existe uma categoria com esse nome" });
      }
      throw e;
    }
  })
);

// PUT /api/categorias/:id  (renomear / mudar cor)
categoriasRouter.put(
  "/:id",
  ah(async (req, res) => {
    const familiaId = (req as any).familiaId as number;
    const id = Number(req.params.id);
    const parsed = CategoriaInput.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ erro: parsed.error.flatten() });
    try {
      const atualizada = await um(
        "UPDATE categorias SET nome = $1, cor = $2 WHERE id = $3 AND familia_id = $4 RETURNING id, nome, cor",
        [parsed.data.nome, parsed.data.cor, id, familiaId]
      );
      if (!atualizada) return res.status(404).json({ erro: "Não encontrada" });
      res.json(atualizada);
    } catch (e: any) {
      if (e?.code === ERRO_UNICO) {
        return res.status(409).json({ erro: "Já existe uma categoria com esse nome" });
      }
      throw e;
    }
  })
);

// DELETE /api/categorias/:id
categoriasRouter.delete(
  "/:id",
  ah(async (req, res) => {
    const familiaId = (req as any).familiaId as number;
    const id = Number(req.params.id);
    const apagada = await um(
      "DELETE FROM categorias WHERE id = $1 AND familia_id = $2 RETURNING id",
      [id, familiaId]
    );
    if (!apagada) return res.status(404).json({ erro: "Não encontrada" });
    res.status(204).end();
  })
);
