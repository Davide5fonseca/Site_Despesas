import { Router } from "express";
import { q, ah } from "../db.js";

export const saldosRouter = Router();

// GET /api/saldos?mes=YYYY-MM   (mes opcional; sem mes = tudo)
saldosRouter.get(
  "/",
  ah(async (req, res) => {
    const familiaId = (req as any).familiaId as number;
    const mes = req.query.mes as string | undefined;
    const filtraMes = !!(mes && /^\d{4}-\d{2}$/.test(mes));

    const membros = await q<{ id: number; nome: string }>(
      "SELECT id, nome FROM membros WHERE familia_id = $1 ORDER BY lower(nome)",
      [familiaId]
    );
    const nomePorId = new Map(membros.map((m) => [m.id, m.nome]));

    // Despesas com pagador (só essas contam)
    const condD = ["familia_id = $1", "membro_id IS NOT NULL"];
    const paramsD: any[] = [familiaId];
    if (filtraMes) {
      condD.push("data LIKE $2");
      paramsD.push(`${mes}-%`);
    }
    const despesas = await q<{ id: number; valor_centimos: number; membro_id: number }>(
      `SELECT id, valor_centimos, membro_id FROM despesas WHERE ${condD.join(" AND ")}`,
      paramsD
    );

    // Participantes de todas essas despesas, numa só query
    const condP = ["d.familia_id = $1", "d.membro_id IS NOT NULL"];
    const paramsP: any[] = [familiaId];
    if (filtraMes) {
      condP.push("d.data LIKE $2");
      paramsP.push(`${mes}-%`);
    }
    const linhasP = await q<{ despesa_id: number; membro_id: number }>(
      `SELECT dm.despesa_id, dm.membro_id
       FROM despesa_membros dm
       JOIN despesas d ON d.id = dm.despesa_id
       WHERE ${condP.join(" AND ")}`,
      paramsP
    );
    const partsPorDespesa = new Map<number, number[]>();
    for (const p of linhasP) {
      if (!nomePorId.has(p.membro_id)) continue;
      const arr = partsPorDespesa.get(p.despesa_id) ?? [];
      arr.push(p.membro_id);
      partsPorDespesa.set(p.despesa_id, arr);
    }

    const pagou = new Map<number, number>();
    const deve = new Map<number, number>();
    const add = (mapa: Map<number, number>, k: number, v: number) =>
      mapa.set(k, (mapa.get(k) || 0) + v);

    let despesasContadas = 0;
    for (const d of despesas) {
      const parts = partsPorDespesa.get(d.id);
      if (!parts || !parts.length) continue;
      despesasContadas++;
      add(pagou, d.membro_id, d.valor_centimos);
      parts.sort((a, b) => a - b);
      const base = Math.floor(d.valor_centimos / parts.length);
      let resto = d.valor_centimos - base * parts.length;
      for (const mid of parts) {
        add(deve, mid, base + (resto > 0 ? 1 : 0));
        if (resto > 0) resto--;
      }
    }

    const saldos = membros.map((m) => {
      const p = pagou.get(m.id) || 0;
      const dv = deve.get(m.id) || 0;
      return { membro_id: m.id, nome: m.nome, pagou: p, deve: dv, saldo: p - dv };
    });

    // Transferências (guloso: menos transferências)
    const credores = saldos.filter((s) => s.saldo > 0).map((s) => ({ ...s }));
    const devedores = saldos.filter((s) => s.saldo < 0).map((s) => ({ ...s, saldo: -s.saldo }));
    credores.sort((a, b) => b.saldo - a.saldo);
    devedores.sort((a, b) => b.saldo - a.saldo);

    const transferencias: Array<{
      de_id: number;
      de_nome: string;
      para_id: number;
      para_nome: string;
      valor: number;
    }> = [];

    let i = 0;
    let j = 0;
    while (i < devedores.length && j < credores.length) {
      const valor = Math.min(devedores[i].saldo, credores[j].saldo);
      if (valor > 0) {
        transferencias.push({
          de_id: devedores[i].membro_id,
          de_nome: devedores[i].nome,
          para_id: credores[j].membro_id,
          para_nome: credores[j].nome,
          valor,
        });
        devedores[i].saldo -= valor;
        credores[j].saldo -= valor;
      }
      if (devedores[i].saldo <= 0) i++;
      if (credores[j].saldo <= 0) j++;
    }

    res.json({ mes: filtraMes ? mes : null, despesasContadas, saldos, transferencias });
  })
);
