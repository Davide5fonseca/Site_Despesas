import "dotenv/config";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { migrate, obterFamiliaComPin, sessaoValida, ah, erroDeLigacao, bdDisponivel } from "./db.js";
import { despesasRouter } from "./routes/despesas.js";
import { categoriasRouter } from "./routes/categorias.js";
import { membrosRouter } from "./routes/membros.js";
import { resumoRouter } from "./routes/resumo.js";
import { saldosRouter } from "./routes/saldos.js";
import { talaoRouter } from "./routes/talao.js";
import { familiasRouter } from "./routes/familias.js";
import { fixasRouter } from "./routes/fixas.js";
import { orcamentosRouter } from "./routes/orcamentos.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TESTE = process.env.NODE_ENV === "test";

export const app = express();
const PORT = Number(process.env.PORT || 3001);

// Render/hosts correm atrás de um proxy -> necessário para o rate-limit ver o IP real.
app.set("trust proxy", 1);

// CORS: em produção restringe à origem do site (FRONTEND_ORIGIN); em dev fica aberto.
const ORIGEM = process.env.FRONTEND_ORIGIN;
app.use(cors(ORIGEM ? { origin: ORIGEM } : {}));
app.use(express.json({ limit: "64kb" }));

// Cabeçalhos de segurança básicos (sem dependências extra).
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "same-origin");
  next();
});

// Rate-limiting global (anti-abuso) + limitadores apertados para as rotas caras.
const limitador = (windowMs: number, limit: number, mensagem: string) =>
  rateLimit({ windowMs, limit, standardHeaders: "draft-7", legacyHeaders: false, message: { erro: mensagem } });
const limiteGlobal = limitador(5 * 60 * 1000, 600, "Demasiados pedidos. Aguarda um pouco.");
const limiteFamilia = limitador(10 * 60 * 1000, 20, "Demasiadas tentativas. Tenta de novo daqui a uns minutos.");
// A leitura por IA custa dinheiro: por IP, e por grupo (o cabeçalho é a chave).
const limiteTalaoIp = limitador(60 * 60 * 1000, 60, "Muitas leituras de talão. Tenta daqui a uma hora.");
const limiteTalaoGrupo = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  limit: Number(process.env.TALAO_LIMITE_DIA || 100),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => `grupo:${req.header("x-familia-codigo") || "?"}`,
  message: { erro: "Este grupo já leu muitos talões hoje. Amanhã volta a funcionar; até lá, introduz à mão." },
});
// Em testes os limitadores são desligados (não interferem com os cenários).
const se = (mw: express.RequestHandler) => (TESTE ? [] : [mw]);
if (!TESTE) app.use("/api", limiteGlobal);

// `ok` = o processo está vivo (health check do Render); `bd` = a base de dados
// responde. Sem BD a app não funciona — é a 1.ª coisa a ver quando algo falha.
app.get(
  "/api/saude",
  ah(async (_req, res) => {
    const bd = await bdDisponivel();
    res.json({ ok: true, bd, ia: Boolean(process.env.ANTHROPIC_API_KEY) });
  })
);

// Criar/entrar numa família NÃO exige família prévia (mas é fortemente limitado).
app.use("/api/familias", ...se(limiteFamilia), familiasRouter);

// Middleware de scoping: resolve o código (cabeçalho x-familia-codigo) -> familia_id.
// Em grupos com PIN exige também um token de sessão (obtido ao entrar com o PIN):
// o código é o que se partilha para convidar, por isso sozinho não chega.
const exigirFamilia = ah(async (req, res, next) => {
  const codigo = req.header("x-familia-codigo");
  if (!codigo) return res.status(401).json({ erro: "Sem família. Cria ou entra numa família." });
  const familia = await obterFamiliaComPin(codigo);
  if (!familia) return res.status(401).json({ erro: "Código de família inválido." });
  if (familia.pin_hash && !(await sessaoValida(familia.id, req.header("x-familia-token")))) {
    return res.status(401).json({ erro: "Sessão inválida. Volta a entrar com o PIN.", pinNecessario: true });
  }
  (req as any).familiaId = familia.id;
  next();
});

app.use("/api/despesas", exigirFamilia, despesasRouter);
app.use("/api/categorias", exigirFamilia, categoriasRouter);
app.use("/api/membros", exigirFamilia, membrosRouter);
app.use("/api/resumo", exigirFamilia, resumoRouter);
app.use("/api/saldos", exigirFamilia, saldosRouter);
app.use("/api/fixas", exigirFamilia, fixasRouter);
app.use("/api/orcamentos", exigirFamilia, orcamentosRouter);
app.use("/api/talao", exigirFamilia, ...se(limiteTalaoIp), ...se(limiteTalaoGrupo), talaoRouter);

// Rotas /api desconhecidas -> 404 JSON (em vez de cair no index.html).
app.all("/api/*", (_req, res) => res.status(404).json({ erro: "Rota não encontrada." }));

// Servir o frontend compilado (Opção A: tudo num só serviço).
const distDir = join(__dirname, "..", "client", "dist");
if (existsSync(distDir)) {
  // Os assets do Vite têm hash no nome -> cache longa; o index.html nunca.
  app.use(
    express.static(distDir, {
      setHeaders(res, caminho) {
        if (/[\\/]assets[\\/]/.test(caminho)) res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        else res.setHeader("Cache-Control", "no-cache");
      },
    })
  );
  app.get("*", (_req, res) => {
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(join(distDir, "index.html"));
  });
}

// Tratamento de erros não previstos
app.use(
  (err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err?.type === "entity.too.large") return res.status(413).json({ erro: "Pedido grande demais." });
    if (err?.type === "entity.parse.failed") return res.status(400).json({ erro: "JSON inválido." });
    if (erroDeLigacao(err)) {
      console.error("Base de dados indisponível:", err?.message || err);
      return res.status(503).json({
        erro:
          "A base de dados está indisponível. Se usas o Supabase gratuito, o projeto pode ter sido " +
          "pausado por inatividade — reativa-o no painel do Supabase e tenta de novo.",
        bd: false,
      });
    }
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
