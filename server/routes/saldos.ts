import { Router } from "express";
import { db } from "../db.js";

export const saldosRouter = Router();

interface DespesaCalc {
  id: number;
  valor_centimos: number;
  membro_id: number | null;
}

// GET /api/saldos?mes=YYYY-MM   (mes opcional; sem mes = tudo)
saldosRouter.get("/", (req, res) => {
  const familiaId = (req as any).familiaId as number;
  const mes = req.query.mes as string | undefined;

  const membros = db
    .prepare("SELECT id, nome FROM membros WHERE familia_id = ? ORDER BY nome COLLATE NOCASE")
    .all(familiaId) as Array<{ id: number; nome: string }>;
  const nomePorId = new Map(membros.map((m) => [m.id, m.nome]));

  // Despesas com pagador definido (só essas entram nos saldos)
  const cond = ["familia_id = ?", "membro_id IS NOT NULL"];
  const params: any[] = [familiaId];
  if (mes && /^\d{4}-\d{2}$/.test(mes)) {
    cond.push("data LIKE ?");
    params.push(`${mes}-%`);
  }
  const despesas = db
    .prepare(`SELECT id, valor_centimos, membro_id FROM despesas WHERE ${cond.join(" AND ")}`)
    .all(...params) as DespesaCalc[];

  const pagou = new Map<number, number>();
  const deve = new Map<number, number>();
  const add = (mapa: Map<number, number>, k: number, v: number) =>
    mapa.set(k, (mapa.get(k) || 0) + v);

  const participantesStmt = db.prepare(
    "SELECT membro_id FROM despesa_membros WHERE despesa_id = ?"
  );

  let despesasContadas = 0;
  for (const d of despesas) {
    const parts = (participantesStmt.all(d.id) as Array<{ membro_id: number }>)
      .map((p) => p.membro_id)
      .filter((id) => nomePorId.has(id));
    if (!parts.length || d.membro_id === null) continue; // não divisível -> ignora

    despesasContadas++;
    add(pagou, d.membro_id, d.valor_centimos);

    // Divide em cêntimos, distribuindo o resto pelos primeiros participantes
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

  // Sugestão de transferências (algoritmo guloso: menos transferências)
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

  res.json({ mes: mes || null, despesasContadas, saldos, transferencias });
});
