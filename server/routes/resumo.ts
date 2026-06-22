import { Router } from "express";
import { q, um, ah } from "../db.js";
import { materializarFixas } from "../lib/fixas.js";

export const resumoRouter = Router();

function ultimosMeses(mes: string, n: number): string[] {
  const [ano, m] = mes.split("-").map(Number);
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(ano, m - 1 - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

// GET /api/resumo?mes=YYYY-MM
resumoRouter.get(
  "/",
  ah(async (req, res) => {
    const familiaId = (req as any).familiaId as number;

    let mes = req.query.mes as string | undefined;
    if (!mes || !/^\d{4}-\d{2}$/.test(mes)) {
      const agora = new Date();
      mes = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}`;
    }
    await materializarFixas(familiaId, mes); // garante as fixas deste mês
    const padrao = `${mes}-%`;

    const totalRow = await um<{ total: string }>(
      "SELECT COALESCE(SUM(valor_centimos), 0) AS total FROM despesas WHERE familia_id = $1 AND data LIKE $2",
      [familiaId, padrao]
    );
    const total = Number(totalRow?.total ?? 0);

    const porCategoria = (
      await q<{ categoria_id: number | null; nome: string; cor: string; total: string }>(
        `SELECT
           d.categoria_id AS categoria_id,
           COALESCE(c.nome, 'Sem categoria') AS nome,
           COALESCE(c.cor, '#94a3b8')        AS cor,
           SUM(d.valor_centimos)             AS total
         FROM despesas d
         LEFT JOIN categorias c ON c.id = d.categoria_id
         WHERE d.familia_id = $1 AND d.data LIKE $2
         GROUP BY d.categoria_id, c.nome, c.cor
         ORDER BY total DESC`,
        [familiaId, padrao]
      )
    ).map((r) => ({ ...r, total: Number(r.total) }));

    const porPessoa = (
      await q<{ membro_id: number | null; nome: string; total: string }>(
        `SELECT
           d.membro_id AS membro_id,
           COALESCE(m.nome, 'Sem pessoa') AS nome,
           SUM(d.valor_centimos)          AS total
         FROM despesas d
         LEFT JOIN membros m ON m.id = d.membro_id
         WHERE d.familia_id = $1 AND d.data LIKE $2
         GROUP BY d.membro_id, m.nome
         ORDER BY total DESC`,
        [familiaId, padrao]
      )
    ).map((r) => ({ ...r, total: Number(r.total) }));

    const meses = ultimosMeses(mes, 6);
    const evolucao = [];
    for (const chave of meses) {
      const row = await um<{ total: string }>(
        "SELECT COALESCE(SUM(valor_centimos), 0) AS total FROM despesas WHERE familia_id = $1 AND data LIKE $2",
        [familiaId, `${chave}-%`]
      );
      evolucao.push({ mes: chave, total: Number(row?.total ?? 0) });
    }

    res.json({ mes, total, porCategoria, porPessoa, evolucao });
  })
);
