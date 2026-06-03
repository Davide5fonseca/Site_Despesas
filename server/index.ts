import "dotenv/config";
import express from "express";
import cors from "cors";
import { migrate } from "./db.js";
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
