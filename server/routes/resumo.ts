import { Router } from "express";
import { db } from "../db.js";

export const resumoRouter = Router();

// Constrói as N chaves de mês ('YYYY-MM') a terminar em `mes` (inclusive).
function ultimosMeses(mes: string, n: number): string[] {
  const [ano, m] = mes.split("-").map(Number);
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(ano, m - 1 - i, 1);
    const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    out.push(chave);
  }
  return out;
}

// GET /api/resumo?mes=YYYY-MM
resumoRouter.get("/", (req, res) => {
  let mes = req.query.mes as string | undefined;
  if (!mes || !/^\d{4}-\d{2}$/.test(mes)) {
    const agora = new Date();
    mes = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}`;
  }
  const padrao = `${mes}-%`;

  // Total do mês
  const total = (
    db
      .prepare("SELECT COALESCE(SUM(valor_centimos), 0) AS total FROM despesas WHERE data LIKE ?")
      .get(padrao) as { total: number }
  ).total;

  // Por categoria (inclui sem categoria)
  const porCategoria = db
    .prepare(
      `SELECT
         d.categoria_id AS categoria_id,
         COALESCE(c.nome, 'Sem categoria') AS nome,
         COALESCE(c.cor, '#94a3b8')        AS cor,
         SUM(d.valor_centimos)             AS total
       FROM despesas d
       LEFT JOIN categorias c ON c.id = d.categoria_id
       WHERE d.data LIKE ?
       GROUP BY d.categoria_id
       ORDER BY total DESC`
    )
    .all(padrao);

  // Por pessoa
  const porPessoa = db
    .prepare(
      `SELECT
         d.membro_id AS membro_id,
         COALESCE(m.nome, 'Sem pessoa') AS nome,
         SUM(d.valor_centimos)          AS total
       FROM despesas d
       LEFT JOIN membros m ON m.id = d.membro_id
       WHERE d.data LIKE ?
       GROUP BY d.membro_id
       ORDER BY total DESC`
    )
    .all(padrao);

  // Evolução dos últimos 6 meses
  const meses = ultimosMeses(mes, 6);
  const somaPorMes = db.prepare(
    "SELECT COALESCE(SUM(valor_centimos), 0) AS total FROM despesas WHERE data LIKE ?"
  );
  const evolucao = meses.map((chave) => ({
    mes: chave,
    total: (somaPorMes.get(`${chave}-%`) as { total: number }).total,
  }));

  res.json({ mes, total, porCategoria, porPessoa, evolucao });
});
