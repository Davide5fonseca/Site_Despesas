import "dotenv/config";
import express from "express";
import cors from "cors";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { migrate, obterFamiliaPorCodigo } from "./db.js";
import { despesasRouter } from "./routes/despesas.js";
import { categoriasRouter } from "./routes/categorias.js";
import { membrosRouter } from "./routes/membros.js";
import { resumoRouter } from "./routes/resumo.js";
import { saldosRouter } from "./routes/saldos.js";
import { talaoRouter } from "./routes/talao.js";
import { familiasRouter } from "./routes/familias.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

migrate();

const app = express();
const PORT = Number(process.env.PORT || 3001);

app.use(cors()); // em rede local/desenvolvimento aceita qualquer origem
app.use(express.json());

app.get("/api/saude", (_req, res) =>
  res.json({ ok: true, ia: Boolean(process.env.ANTHROPIC_API_KEY) })
);

// Criar/entrar numa família NÃO exige família prévia.
app.use("/api/familias", familiasRouter);

// Middleware de scoping: resolve o código (cabeçalho x-familia-codigo) -> familia_id.
// Todas as rotas de dados ficam restritas à família do utilizador.
function exigirFamilia(req: express.Request, res: express.Response, next: express.NextFunction) {
  const codigo = req.header("x-familia-codigo");
  if (!codigo) return res.status(401).json({ erro: "Sem família. Cria ou entra numa família." });
  const familia = obterFamiliaPorCodigo(codigo);
  if (!familia) return res.status(401).json({ erro: "Código de família inválido." });
  (req as any).familiaId = familia.id;
  next();
}

app.use("/api/despesas", exigirFamilia, despesasRouter);
app.use("/api/categorias", exigirFamilia, categoriasRouter);
app.use("/api/membros", exigirFamilia, membrosRouter);
app.use("/api/resumo", exigirFamilia, resumoRouter);
app.use("/api/saldos", exigirFamilia, saldosRouter);
app.use("/api/talao", exigirFamilia, talaoRouter);

// ─────────────────────────────────────────────────────────────────────────
// Servir o frontend compilado (Opção A: tudo num só serviço).
// Em produção (Render) o build do cliente fica em client/dist e é servido aqui,
// na MESMA origem da API -> sem CORS e sem VITE_API_URL.
// Em desenvolvimento usa-se o Vite (porta 5173) e este bloco é ignorado se não
// existir build.
// ─────────────────────────────────────────────────────────────────────────
const distDir = join(__dirname, "..", "client", "dist");
if (existsSync(distDir)) {
  app.use(express.static(distDir));
  // Fallback SPA: tudo o que não for /api devolve o index.html (React Router).
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

// 0.0.0.0 -> acessível por outros dispositivos na mesma rede Wi-Fi
app.listen(PORT, "0.0.0.0", () => {
  console.log(`API a correr em http://0.0.0.0:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn(
      "⚠️  ANTHROPIC_API_KEY não definida — a leitura de talões por IA ficará indisponível."
    );
  }
});
