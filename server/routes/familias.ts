import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import {
  criarFamilia,
  obterFamiliaComPin,
  apagarFamiliaPorCodigo,
  contarMembros,
  criarSessao,
  sessaoValida,
  ah,
  pool,
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
const AtualizarInput = z.object({
  nome: z.string().trim().min(1, "Indica um nome").max(60).optional(),
  // Rendimento mensal em cêntimos (null = limpar). Serve para a poupança.
  rendimento_centimos: z.number().int().nonnegative().max(1_000_000_00).nullable().optional(),
});

// Resposta pública da família: nunca inclui pin_hash; indica se tem PIN.
function publica(f: { id: number; codigo: string; nome: string; pin_hash?: string | null; rendimento_centimos?: number | null }) {
  return {
    id: f.id,
    codigo: f.codigo,
    nome: f.nome,
    temPin: Boolean(f.pin_hash),
    rendimento_centimos: f.rendimento_centimos ?? null,
  };
}

// POST /api/familias  -> cria família (PIN opcional), devolve o código (+ token se tiver PIN)
familiasRouter.post(
  "/",
  ah(async (req, res) => {
    const parsed = CriarInput.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ erro: parsed.error.flatten() });
    const pinHash = parsed.data.pin ? await bcrypt.hash(parsed.data.pin, 10) : null;
    const familia = await criarFamilia(parsed.data.nome, pinHash);
    // Quem cria um grupo com PIN já provou conhecê-lo: recebe logo a sessão.
    const token = pinHash ? await criarSessao(familia.id) : undefined;
    res.status(201).json({ ...publica({ ...familia, pin_hash: pinHash }), token });
  })
);

// POST /api/familias/entrar  -> valida código (+ PIN se aplicável).
// Com PIN devolve um `token` que passa a ser obrigatório (cabeçalho x-familia-token).
familiasRouter.post(
  "/entrar",
  ah(async (req, res) => {
    const parsed = EntrarInput.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ erro: parsed.error.flatten() });

    const familia = await obterFamiliaComPin(parsed.data.codigo);
    if (!familia) {
      return res.status(404).json({ erro: "Não existe nenhuma família com esse código." });
    }
    let token: string | undefined;
    if (familia.pin_hash) {
      if (!parsed.data.pin) {
        return res.status(401).json({ erro: "Esta família está protegida por PIN.", pinNecessario: true });
      }
      const ok = await bcrypt.compare(parsed.data.pin, familia.pin_hash);
      if (!ok) return res.status(401).json({ erro: "PIN incorreto.", pinNecessario: true });
      token = await criarSessao(familia.id);
    }
    res.json({ ...publica(familia), token });
  })
);

// Autoriza um pedido à família atual (código + token se houver PIN).
// Devolve a família ou responde com o erro adequado e devolve null.
async function autorizar(req: import("express").Request, res: import("express").Response) {
  const codigo = req.header("x-familia-codigo");
  if (!codigo) {
    res.status(401).json({ erro: "Sem família." });
    return null;
  }
  const familia = await obterFamiliaComPin(codigo);
  if (!familia) {
    res.status(404).json({ erro: "Família não encontrada." });
    return null;
  }
  if (familia.pin_hash && !(await sessaoValida(familia.id, req.header("x-familia-token")))) {
    res.status(401).json({ erro: "Sessão inválida. Volta a entrar com o PIN.", pinNecessario: true });
    return null;
  }
  return familia;
}

// GET /api/familias/atual  -> info da família atual
familiasRouter.get(
  "/atual",
  ah(async (req, res) => {
    const familia = await autorizar(req, res);
    if (!familia) return;
    res.json(publica(familia));
  })
);

// PATCH /api/familias/atual  -> renomear / definir rendimento mensal
familiasRouter.patch(
  "/atual",
  ah(async (req, res) => {
    const familia = await autorizar(req, res);
    if (!familia) return;
    const parsed = AtualizarInput.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ erro: parsed.error.flatten() });
    const d = parsed.data;
    const r = await pool.query(
      `UPDATE familias
          SET nome = COALESCE($1, nome),
              rendimento_centimos = CASE WHEN $2::boolean THEN $3 ELSE rendimento_centimos END
        WHERE id = $4
        RETURNING id, codigo, nome, pin_hash, rendimento_centimos`,
      [d.nome ?? null, d.rendimento_centimos !== undefined, d.rendimento_centimos ?? null, familia.id]
    );
    res.json(publica(r.rows[0]));
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

