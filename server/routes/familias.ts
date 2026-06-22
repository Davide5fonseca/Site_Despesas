import { Router } from "express";
import { z } from "zod";
import { criarFamilia, obterFamiliaPorCodigo, ah } from "../db.js";

export const familiasRouter = Router();

const CriarInput = z.object({
  nome: z.string().trim().min(1, "Indica um nome para a família").max(60),
});
const EntrarInput = z.object({
  codigo: z.string().trim().min(4, "Código inválido").max(12),
});

// POST /api/familias  -> cria família + categorias iniciais, devolve o código
familiasRouter.post(
  "/",
  ah(async (req, res) => {
    const parsed = CriarInput.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ erro: parsed.error.flatten() });
    const familia = await criarFamilia(parsed.data.nome);
    res.status(201).json(familia);
  })
);

// POST /api/familias/entrar  -> valida o código e devolve a família
familiasRouter.post(
  "/entrar",
  ah(async (req, res) => {
    const parsed = EntrarInput.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ erro: parsed.error.flatten() });
    const familia = await obterFamiliaPorCodigo(parsed.data.codigo);
    if (!familia) return res.status(404).json({ erro: "Não existe nenhuma família com esse código." });
    res.json(familia);
  })
);

// GET /api/familias/atual  -> info da família atual (via cabeçalho x-familia-codigo)
familiasRouter.get(
  "/atual",
  ah(async (req, res) => {
    const codigo = req.header("x-familia-codigo");
    if (!codigo) return res.status(401).json({ erro: "Sem família." });
    const familia = await obterFamiliaPorCodigo(codigo);
    if (!familia) return res.status(404).json({ erro: "Família não encontrada." });
    res.json(familia);
  })
);
