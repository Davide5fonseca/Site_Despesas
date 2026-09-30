import { Router } from "express";
import { q, um, ah } from "../db.js";
import { materializarFixas } from "../lib/fixas.js";
import { mesAtual, ultimosMeses, deslocarMes, RE_MES } from "../lib/tempo.js";
import { listarOrcamentos } from "./orcamentos.js";

export const resumoRouter = Router();

// GET /api/resumo?mes=YYYY-MM
resumoRouter.get(
  "/",
  ah(async (req, res) => {
    const familiaId = (req as any).familiaId as number;

    let mes = req.query.mes as string | undefined;
    if (!mes || !RE_MES.test(mes)) mes = mesAtual();
    const padrao = `${mes}-%`;
    const mesAnterior = deslocarMes(mes, -1);

    // Garante as fixas deste mês e dos anteriores (a evolução mostra 6 meses).
    await materializarFixas(familiaId, mes);

    const [totalRow, porCategoria, porPessoa, evolucaoRows, orcamentos, familia] = await Promise.all([
      um<{ total: string }>(
        "SELECT COALESCE(SUM(valor_centimos), 0) AS total FROM despesas WHERE familia_id = $1 AND data LIKE $2",
        [familiaId, padrao]
      ),
      q<{ categoria_id: number | null; nome: string; cor: string; total: string; anterior: string }>(
        `WITH atual AS (
           SELECT categoria_id, SUM(valor_centimos) AS total
             FROM despesas WHERE familia_id = $1 AND data LIKE $2 GROUP BY categoria_id
         ), anterior AS (
           SELECT categoria_id, SUM(valor_centimos) AS total
             FROM despesas WHERE familia_id = $1 AND data LIKE $3 GROUP BY categoria_id
         )
         SELECT a.categoria_id,
                COALESCE(c.nome, 'Sem categoria') AS nome,
                COALESCE(c.cor, '#94a3b8')        AS cor,
                a.total,
                COALESCE(p.total, 0)              AS anterior
           FROM atual a
           LEFT JOIN categorias c ON c.id = a.categoria_id
           LEFT JOIN anterior p ON COALESCE(p.categoria_id, 0) = COALESCE(a.categoria_id, 0)
          ORDER BY a.total DESC`,
        [familiaId, padrao, `${mesAnterior}-%`]
      ),
      q<{ membro_id: number | null; nome: string; total: string }>(
        `SELECT d.membro_id, COALESCE(m.nome, 'Sem pessoa') AS nome, SUM(d.valor_centimos) AS total
           FROM despesas d LEFT JOIN membros m ON m.id = d.membro_id
          WHERE d.familia_id = $1 AND d.data LIKE $2
          GROUP BY d.membro_id, m.nome
          ORDER BY total DESC`,
        [familiaId, padrao]
      ),
      // Evolução: uma só query agrupada por mês (em vez de 6 pedidos).
      q<{ mes: string; total: string }>(
        `SELECT substr(data, 1, 7) AS mes, SUM(valor_centimos) AS total
           FROM despesas
          WHERE familia_id = $1 AND data >= $2 AND data < $3
          GROUP BY 1`,
        [familiaId, `${deslocarMes(mes, -5)}-01`, `${deslocarMes(mes, 1)}-01`]
      ),
      listarOrcamentos(familiaId),
      um<{ rendimento_centimos: number | null }>("SELECT rendimento_centimos FROM familias WHERE id = $1", [familiaId]),
    ]);

    const total = Number(totalRow?.total ?? 0);
    const porMes = new Map(evolucaoRows.map((r) => [r.mes, Number(r.total)]));
    const evolucao = ultimosMeses(mes, 6).map((chave) => ({ mes: chave, total: porMes.get(chave) ?? 0 }));

    // Orçamentos com o gasto do mês encaixado (categoria ou total).
    const gastoPorCat = new Map(porCategoria.map((r) => [r.categoria_id ?? 0, Number(r.total)]));
    const orcamentosEstado = orcamentos.map((o) => ({
      categoria_id: o.categoria_id,
      valor_centimos: o.valor_centimos,
      gasto: o.categoria_id == null ? total : gastoPorCat.get(o.categoria_id) ?? 0,
    }));

    // Poupança: rendimento mensal (se definido) menos o gasto do mês.
    const rendimento = familia?.rendimento_centimos ?? null;
    const anteriorTotal = porCategoria.reduce((s, r) => s + Number(r.anterior), 0);

    res.json({
      mes,
      total,
      totalMesAnterior: anteriorTotal,
      rendimento_centimos: rendimento,
      poupanca_centimos: rendimento != null ? rendimento - total : null,
      porCategoria: porCategoria.map((r) => ({
        categoria_id: r.categoria_id,
        nome: r.nome,
        cor: r.cor,
        total: Number(r.total),
        anterior: Number(r.anterior),
      })),
      porPessoa: porPessoa.map((r) => ({ ...r, total: Number(r.total) })),
      evolucao,
      orcamentos: orcamentosEstado,
    });
  })
);
