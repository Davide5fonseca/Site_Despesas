import { Router } from "express";
import { z } from "zod";
import { q, um, ah, pool } from "../db.js";

export const orcamentosRouter = Router();

// Orçamento mensal por categoria (categoria_id) ou total (categoria_id null).
// Um valor null/0 apaga o orçamento.
const OrcamentoInput = z.object({
  categoria_id: z.number().int().positive().nullable(),
  valor_centimos: z.number().int().nonnegative().nullable(),
});

export interface Orcamento {
  categoria_id: number | null;
  valor_centimos: number;
}

export async function listarOrcamentos(familiaId: number): Promise<Orcamento[]> {
  return q<Orcamento>(
    "SELECT categoria_id, valor_centimos FROM orcamentos WHERE familia_id = $1 ORDER BY categoria_id NULLS FIRST",
    [familiaId]
  );
}

// GET /api/orcamentos
orcamentosRouter.get(
  "/",
  ah(async (req, res) => {
    res.json(await listarOrcamentos((req as any).familiaId as number));
  })
);

// PUT /api/orcamentos  -> define/atualiza/apaga um orçamento
orcamentosRouter.put(
  "/",
  ah(async (req, res) => {
    const familiaId = (req as any).familiaId as number;
    const parsed = OrcamentoInput.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ erro: parsed.error.flatten() });
    const { categoria_id, valor_centimos } = parsed.data;

    if (categoria_id != null) {
      const ok = await um("SELECT 1 FROM categorias WHERE id = $1 AND familia_id = $2", [categoria_id, familiaId]);
      if (!ok) return res.status(400).json({ erro: "Categoria inválida para esta família." });
    }

    // Apaga sempre o anterior; insere se houver valor. (O índice único usa
    // COALESCE(categoria_id, 0), por isso não dá para usar ON CONFLICT simples.)
    await pool.query(
      "DELETE FROM orcamentos WHERE familia_id = $1 AND COALESCE(categoria_id, 0) = COALESCE($2, 0)",
      [familiaId, categoria_id]
    );
    if (valor_centimos && valor_centimos > 0) {
      await pool.query(
        "INSERT INTO orcamentos (familia_id, categoria_id, valor_centimos) VALUES ($1, $2, $3)",
        [familiaId, categoria_id, valor_centimos]
      );
    }
    res.json(await listarOrcamentos(familiaId));
  })
);
