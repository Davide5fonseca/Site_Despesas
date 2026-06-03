import "dotenv/config";
import express from "express";
import cors from "cors";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { migrate } from "./db.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
import { despesasRouter } from "./routes/despesas.js";
import { categoriasRouter } from "./routes/categorias.js";
import { membrosRouter } from "./routes/membros.js";
import { resumoRouter } from "./routes/resumo.js";
import { talaoRouter } from "./routes/talao.js";

migrate();

const app = express();
const PORT = Number(process.env.PORT || 3001);

app.use(cors()); // em rede local/desenvolvimento aceita qualquer origem
app.use(express.json());

app.get("/api/saude", (_req, res) =>
  res.json({ ok: true, ia: Boolean(process.env.ANTHROPIC_API_KEY) })
);

app.use("/api/despesas", despesasRouter);
app.use("/api/categorias", categoriasRouter);
app.use("/api/membros", membrosRouter);
app.use("/api/resumo", resumoRouter);
app.use("/api/talao", talaoRouter);

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
