import "dotenv/config";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
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
import { fixasRouter } from "./routes/fixas.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TESTE = process.env.NODE_ENV === "test";

export const app = express();
const PORT = Number(process.env.PORT || 3001);

// Render/hosts correm atrás de um proxy -> necessário para o rate-limit ver o IP real.
app.set("trust proxy", 1);

// CORS: em produção restringe à origem do site (FRONTEND_ORIGIN); em dev fica aberto.
const ORIGEM = process.env.FRONTEND_ORIGIN;
app.use(cors(ORIGEM ? { origin: ORIGEM } : {}));
app.use(express.json());

// Rate-limiting global (anti-abuso) + limitador apertado para criar/entrar família.
const limiteGlobal = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 600,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { erro: "Demasiados pedidos. Aguarda um pouco." },
});
const limiteFamilia = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20, // máx. 20 tentativas de criar/entrar por IP em 10 min
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { erro: "Demasiadas tentativas. Tenta de novo daqui a uns minutos." },
});
// Em testes os limitadores são desligados (não interferem com os cenários).
if (!TESTE) app.use("/api", limiteGlobal);

app.get("/api/saude", (_req, res) =>
  res.json({ ok: true, ia: Boolean(process.env.ANTHROPIC_API_KEY) })
);

// Criar/entrar numa família NÃO exige família prévia (mas é fortemente limitado).
app.use("/api/familias", ...(TESTE ? [] : [limiteFamilia]), familiasRouter);

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
app.use("/api/fixas", exigirFamilia, fixasRouter);
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

// Arranque. (Em testes, a app é importada e o ciclo de vida é gerido pelo runner.)
if (!TESTE) {
  // Escuta JÁ, para o health check (/api/saude) passar mesmo que a base de dados
  // demore a responder — senão o deploy fica em "Timed Out".
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`API a correr em http://0.0.0.0:${PORT}`);
    if (!process.env.ANTHROPIC_API_KEY) {
      console.warn(
        "⚠️  ANTHROPIC_API_KEY não definida — a leitura de talões por IA usa o OCR do telemóvel."
      );
    }
  });
  // Migra em segundo plano. Se falhar, regista o erro mas NÃO derruba o serviço
  // (o site continua a abrir e o erro fica visível nos logs).
  migrate()
    .then(() => console.log("Base de dados pronta."))
    .catch((e) => console.error("Falha a migrar a base de dados:", e.message));
}
