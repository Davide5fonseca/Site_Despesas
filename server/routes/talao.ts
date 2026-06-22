import { Router } from "express";
import multer from "multer";
import { q } from "../db.js";
import { lerTalao } from "../lib/anthropic.js";

export const talaoRouter = Router();

// Recebe a imagem em memória (não grava em disco). Limite 8 MB.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

// POST /api/talao/ler  (multipart/form-data, campo "imagem")
// Devolve os dados extraídos pela IA. NÃO grava a despesa.
talaoRouter.post("/ler", (req, res) => {
  upload.single("imagem")(req, res, async (erroUpload) => {
    // Erros do multer (ex.: ficheiro grande demais)
    if (erroUpload) {
      const grande = (erroUpload as any).code === "LIMIT_FILE_SIZE";
      return res.status(grande ? 413 : 400).json({
        erro: grande
          ? "Imagem grande demais (máx. 8 MB). Tira a foto com menos resolução."
          : "Falha a receber a imagem.",
      });
    }

    const ficheiro = req.file;
    if (!ficheiro) {
      return res.status(400).json({ erro: "Nenhuma imagem recebida (campo 'imagem')." });
    }
    if (!ficheiro.mimetype.startsWith("image/")) {
      return res.status(400).json({ erro: "O ficheiro enviado não é uma imagem." });
    }

    try {
      const familiaId = (req as any).familiaId as number;
      // Lista de categorias da família para a IA escolher de entre elas.
      const categorias = (
        await q<{ nome: string }>(
          "SELECT nome FROM categorias WHERE familia_id = $1 ORDER BY lower(nome)",
          [familiaId]
        )
      ).map((c) => c.nome);

      const base64 = ficheiro.buffer.toString("base64");
      const extraido = await lerTalao(base64, ficheiro.mimetype, categorias);

      res.json(extraido);
    } catch (e: any) {
      // Chave em falta -> 500 com mensagem clara
      if (e?.codigo === "SEM_CHAVE") {
        return res.status(500).json({
          erro: "Leitura por IA indisponível: falta a ANTHROPIC_API_KEY no servidor.",
        });
      }
      // Erros da API Anthropic (rede, créditos, rate limit, etc.)
      const status = e?.status && Number.isInteger(e.status) ? e.status : 502;
      console.error("Erro ao ler talão:", e?.message || e);
      res.status(status >= 400 && status < 600 ? status : 502).json({
        erro:
          "Não foi possível ler o talão agora. Verifica a ligação à internet e tenta de novo, ou introduz manualmente.",
      });
    }
  });
});
