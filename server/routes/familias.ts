import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import {
  criarFamilia,
  obterFamiliaPorCodigo,
  obterFamiliaComPin,
  apagarFamiliaPorCodigo,
  contarMembros,
  ah,
} from "../db.js";

export const familiasRouter = Router();

const CriarInput = z.object({
  nome: z.string().trim().min(1, "Indica um nome").max(60),
  pin: z.string().trim().min(4, "O PIN deve ter pelo menos 4 caracteres").max(12).optional(),
});
const EntrarInput = z.object({
  codigo: z.string().trim().min(4, "Código inválido").max(12),
  pin: z.string().trim().max(12).optional(),
});

// POST /api/familias  -> cria família (PIN opcional), devolve o código
familiasRouter.post(
  "/",
  ah(async (req, res) => {
    const parsed = CriarInput.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ erro: parsed.error.flatten() });
    const pinHash = parsed.data.pin ? await bcrypt.hash(parsed.data.pin, 10) : null;
    const familia = await criarFamilia(parsed.data.nome, pinHash);
    res.status(201).json(familia);
  })
);

// POST /api/familias/entrar  -> valida código (+ PIN se aplicável)
familiasRouter.post(
  "/entrar",
  ah(async (req, res) => {
    const parsed = EntrarInput.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ erro: parsed.error.flatten() });

    const familia = await obterFamiliaComPin(parsed.data.codigo);
    if (!familia) {
      return res.status(404).json({ erro: "Não existe nenhuma família com esse código." });
    }
    if (familia.pin_hash) {
      if (!parsed.data.pin) {
        return res.status(401).json({ erro: "Esta família está protegida por PIN.", pinNecessario: true });
      }
      const ok = await bcrypt.compare(parsed.data.pin, familia.pin_hash);
      if (!ok) return res.status(401).json({ erro: "PIN incorreto.", pinNecessario: true });
    }
    // Nunca devolver o pin_hash
    res.json({ id: familia.id, codigo: familia.codigo, nome: familia.nome });
  })
);

// DELETE /api/familias  -> apaga o grupo atual (via cabeçalho x-familia-codigo).
// SEGURANÇA: o código é a chave que se PARTILHA para convidar — não chega para
// autorizar uma deleção em cascata. Por isso:
//   - só grupos INDIVIDUAIS (<= 1 membro) podem ser apagados aqui;
//   - grupos de 2+ membros são recusados (403) — sem caminho de deleção por agora;
//   - defesa em profundidade: se o grupo tiver PIN, exige-o e valida-o.
familiasRouter.delete(
  "/",
  ah(async (req, res) => {
    const codigo = req.header("x-familia-codigo");
    if (!codigo) return res.status(401).json({ erro: "Sem grupo." });

    const familia = await obterFamiliaComPin(codigo);
    if (!familia) return res.status(404).json({ erro: "Grupo não encontrado." });

    const nMembros = await contarMembros(familia.id);
    if (nMembros > 1) {
      return res.status(403).json({ erro: "Só é possível apagar um grupo individual." });
    }

    if (familia.pin_hash) {
      const pin = (req.body?.pin ?? "").toString().trim();
      if (!pin) {
        return res.status(401).json({ erro: "Este grupo tem PIN.", pinNecessario: true });
      }
      const ok = await bcrypt.compare(pin, familia.pin_hash);
      if (!ok) return res.status(401).json({ erro: "PIN incorreto.", pinNecessario: true });
    }

    await apagarFamiliaPorCodigo(codigo);
    res.status(204).end();
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
