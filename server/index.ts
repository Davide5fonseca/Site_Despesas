import "dotenv/config";
import express from "express";
import cors from "cors";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { migrate, obterFamiliaPorCodigo, ah } from "./db.js";
import { despesasRouter } from "./routes/despesas.js";
import { categoriasRouter } from "./routes/categorias.js";
import { membrosRouter } from "./routes/membros.js";
import { resumoRouter } from "./routes/resumo.js";
import { saldosRouter } from "./routes/saldos.js";
import { talaoRouter } from "./routes/talao.js";
import { familiasRouter } from "./routes/familias.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = Number(process.env.PORT || 3001);

app.use(cors());
app.use(express.json());

app.get("/api/saude", (_req, res) =>
  res.json({ ok: true, ia: Boolean(process.env.ANTHROPIC_API_KEY) })
);

// Criar/entrar numa família NÃO exige família prévia.
app.use("/api/familias", familiasRouter);

// Middleware de scoping: resolve o código (cabeçalho x-familia-codigo) -> familia_id.
const exigirFamilia = ah(async (req, res, next) => {
  const codigo = req.header("x-familia-codigo");
  if (!codigo) return res.status(401).json({ erro: "Sem família. Cria ou entra numa família." });
  const familia = await obterFamiliaPorCodigo(codigo);
  if (!familia) return res.status(401).json({ erro: "Código de família inválido." });
  (req as any).familiaId = familia.id;
  next();
});

app.use("/api/despesas", exigirFamilia, despesasRouter);
app.use("/api/categorias", exigirFamilia, categoriasRouter);
app.use("/api/membros", exigirFamilia, membrosRouter);
app.use("/api/resumo", exigirFamilia, resumoRouter);
app.use("/api/saldos", exigirFamilia, saldosRouter);
app.use("/api/talao", exigirFamilia, talaoRouter);

// Servir o frontend compilado (Opção A: tudo num só serviço).
const distDir = join(__dirname, "..", "client", "dist");
if (existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(join(distDir, "index.html"));
  });
}

// Tratamento de erros não previstos
app.use(
  (err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({ erro: "Erro interno do servidor" });
  }
);

// Arranque: garante a base de dados antes de aceitar pedidos.
migrate()
  .then(() => {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`API a correr em http://0.0.0.0:${PORT}`);
      if (!process.env.ANTHROPIC_API_KEY) {
        console.warn(
          "⚠️  ANTHROPIC_API_KEY não definida — a leitura de talões por IA usa o OCR do telemóvel."
        );
      }
    });
  })
  .catch((e) => {
    console.error("Falha a ligar/migrar a base de dados:", e.message);
    process.exit(1);
  });
