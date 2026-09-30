import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";

// Modo de teste + base de dados de teste (Postgres em Docker), definidos ANTES
// de importar a app (db.ts cria o pool no import). dotenv não sobrepõe estes.
// Arrancar a BD: npm run db:test  (ver package.json)
process.env.NODE_ENV = "test";
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL || "postgres://postgres:postgres@localhost:5433/despesas";

const { app } = await import("../index.js");
const { migrate, pool } = await import("../db.js");

const com = (codigo: string, token?: string) => ({
  "x-familia-codigo": codigo,
  ...(token ? { "x-familia-token": token } : {}),
});

async function novaFamilia(nome = "Casa", pin?: string) {
  const r = await request(app).post("/api/familias").send({ nome, pin });
  return r.body as { id: number; codigo: string; nome: string; temPin: boolean; token?: string };
}

function mesAtualLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

before(async () => {
  await migrate();
  await pool.query("TRUNCATE familias RESTART IDENTITY CASCADE");
});
after(async () => {
  await pool.query("TRUNCATE familias RESTART IDENTITY CASCADE");
  await pool.end();
});

test("GET /api/saude responde ok", async () => {
  const r = await request(app).get("/api/saude");
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
});

test("rota /api desconhecida -> 404 JSON", async () => {
  const r = await request(app).get("/api/nao-existe");
  assert.equal(r.status, 404);
  assert.ok(r.body.erro);
});

test("cria família com código de 8 caracteres e sem PIN não há token", async () => {
  const r = await request(app).post("/api/familias").send({ nome: "Casa A" });
  assert.equal(r.status, 201);
  assert.equal(r.body.codigo.length, 8);
  assert.equal(r.body.temPin, false);
  assert.equal(r.body.token, undefined);
});

test("PIN: bloqueia sem PIN, rejeita errado, aceita certo (sem expor hash) e devolve token", async () => {
  const f = await novaFamilia("ComPin", "1234");
  assert.ok(f.token, "criar com PIN devolve token de sessão");

  const semPin = await request(app).post("/api/familias/entrar").send({ codigo: f.codigo });
  assert.equal(semPin.status, 401);
  assert.equal(semPin.body.pinNecessario, true);

  const errado = await request(app).post("/api/familias/entrar").send({ codigo: f.codigo, pin: "0000" });
  assert.equal(errado.status, 401);

  const certo = await request(app).post("/api/familias/entrar").send({ codigo: f.codigo, pin: "1234" });
  assert.equal(certo.status, 200);
  assert.equal(certo.body.codigo, f.codigo);
  assert.equal(certo.body.pin_hash, undefined);
  assert.ok(certo.body.token);
});

test("PIN protege os dados: só o código não chega, token sim", async () => {
  const f = await novaFamilia("Cofre", "9999");
  const soCodigo = await request(app).get("/api/categorias").set(com(f.codigo));
  assert.equal(soCodigo.status, 401);
  assert.equal(soCodigo.body.pinNecessario, true);

  const tokenFalso = await request(app).get("/api/categorias").set(com(f.codigo, "abc"));
  assert.equal(tokenFalso.status, 401);

  const comToken = await request(app).get("/api/categorias").set(com(f.codigo, f.token));
  assert.equal(comToken.status, 200);
  assert.equal(comToken.body.length, 8);
});

test("código inválido -> 404", async () => {
  const r = await request(app).post("/api/familias/entrar").send({ codigo: "XXXXXXXX" });
  assert.equal(r.status, 404);
});

test("rotas protegidas exigem família (401 sem cabeçalho)", async () => {
  const r = await request(app).get("/api/categorias");
  assert.equal(r.status, 401);
});

test("nova família traz 8 categorias semeadas", async () => {
  const f = await novaFamilia("Seed");
  const r = await request(app).get("/api/categorias").set(com(f.codigo));
  assert.equal(r.status, 200);
  assert.equal(r.body.length, 8);
});

test("PATCH /familias/atual define rendimento e o resumo calcula a poupança", async () => {
  const f = await novaFamilia("Poupa");
  const p = await request(app).patch("/api/familias/atual").set(com(f.codigo)).send({ rendimento_centimos: 200000 });
  assert.equal(p.status, 200);
  assert.equal(p.body.rendimento_centimos, 200000);

  const mes = mesAtualLocal();
  await request(app).post("/api/despesas").set(com(f.codigo)).send({
    valor_centimos: 50000, descricao: "renda", categoria_id: null, membro_id: null,
    data: `${mes}-05`, origem: "manual", participantes: [],
  });
  const r = await request(app).get(`/api/resumo?mes=${mes}`).set(com(f.codigo));
  assert.equal(r.status, 200);
  assert.equal(r.body.total, 50000);
  assert.equal(r.body.poupanca_centimos, 150000);
  assert.equal(r.body.evolucao.length, 6);
});

test("cria e lista despesa com participantes", async () => {
  const f = await novaFamilia("CRUD");
  const cats = (await request(app).get("/api/categorias").set(com(f.codigo))).body;
  const ana = (await request(app).post("/api/membros").set(com(f.codigo)).send({ nome: "Ana" })).body;

  const d = await request(app).post("/api/despesas").set(com(f.codigo)).send({
    valor_centimos: 1500, descricao: "Teste", categoria_id: cats[0].id,
    membro_id: ana.id, data: "2026-06-22", origem: "manual", participantes: [ana.id],
  });
  assert.equal(d.status, 201);
  assert.deepEqual(d.body.participantes, [ana.id]);

  const lista = await request(app).get("/api/despesas?mes=2026-06").set(com(f.codigo));
  assert.equal(lista.body.length, 1);
});

test("data inválida (2026-02-31) -> 400", async () => {
  const f = await novaFamilia("Datas");
  const d = await request(app).post("/api/despesas").set(com(f.codigo)).send({
    valor_centimos: 100, descricao: "x", categoria_id: null, membro_id: null,
    data: "2026-02-31", origem: "manual", participantes: [],
  });
  assert.equal(d.status, 400);
});

test("cliente_id repetido não duplica (idempotência offline)", async () => {
  const f = await novaFamilia("Idem");
  const payload = {
    valor_centimos: 700, descricao: "café", categoria_id: null, membro_id: null,
    data: "2026-06-22", origem: "manual", participantes: [], cliente_id: "11111111-2222-4333-8444-555555555555",
  };
  const a = await request(app).post("/api/despesas").set(com(f.codigo)).send(payload);
  const b = await request(app).post("/api/despesas").set(com(f.codigo)).send(payload);
  assert.equal(a.status, 201);
  assert.equal(b.status, 200);
  assert.equal(a.body.id, b.body.id);
  const lista = await request(app).get("/api/despesas?mes=2026-06").set(com(f.codigo));
  assert.equal(lista.body.length, 1);
});

test("rejeita categoria de outra família (400)", async () => {
  const fa = await novaFamilia("FamA");
  const fb = await novaFamilia("FamB");
  const catsB = (await request(app).get("/api/categorias").set(com(fb.codigo))).body;

  const d = await request(app).post("/api/despesas").set(com(fa.codigo)).send({
    valor_centimos: 100, descricao: "x", categoria_id: catsB[0].id,
    membro_id: null, data: "2026-06-22", origem: "manual", participantes: [],
  });
  assert.equal(d.status, 400);
});

test("saldos: acertar contas calcula corretamente", async () => {
  const f = await novaFamilia("Saldos");
  const ana = (await request(app).post("/api/membros").set(com(f.codigo)).send({ nome: "Ana" })).body;
  const ze = (await request(app).post("/api/membros").set(com(f.codigo)).send({ nome: "Ze" })).body;

  // Ana paga 30€ (dividido por ambos), Ze paga 10€ (dividido por ambos)
  await request(app).post("/api/despesas").set(com(f.codigo)).send({
    valor_centimos: 3000, descricao: "j", categoria_id: null, membro_id: ana.id,
    data: "2026-06-22", origem: "manual", participantes: [ana.id, ze.id],
  });
  await request(app).post("/api/despesas").set(com(f.codigo)).send({
    valor_centimos: 1000, descricao: "c", categoria_id: null, membro_id: ze.id,
    data: "2026-06-22", origem: "manual", participantes: [ana.id, ze.id],
  });

  const s = (await request(app).get("/api/saldos").set(com(f.codigo))).body;
  const saldoAna = s.saldos.find((x: any) => x.membro_id === ana.id).saldo;
  const saldoZe = s.saldos.find((x: any) => x.membro_id === ze.id).saldo;
  assert.equal(saldoAna, 1000); // pagou 3000, deve 2000 (15+5)
  assert.equal(saldoZe, -1000);
  assert.equal(s.transferencias.length, 1);
  assert.deepEqual(
    { de: s.transferencias[0].de_nome, para: s.transferencias[0].para_nome, valor: s.transferencias[0].valor },
    { de: "Ze", para: "Ana", valor: 1000 }
  );
});

test("despesas fixas geram-se no mês atual e não duplicam", async () => {
  const f = await novaFamilia("Fixas");
  const cats = (await request(app).get("/api/categorias").set(com(f.codigo))).body;
  const ana = (await request(app).post("/api/membros").set(com(f.codigo)).send({ nome: "Ana" })).body;

  const fixa = await request(app).post("/api/fixas").set(com(f.codigo)).send({
    valor_centimos: 799, descricao: "Netflix", categoria_id: cats[0].id,
    membro_id: ana.id, dia: 1, participantes: [ana.id], ativa: true,
  });
  assert.equal(fixa.status, 201);

  const mes = mesAtualLocal();
  const lista1 = (await request(app).get(`/api/despesas?mes=${mes}`).set(com(f.codigo))).body;
  const geradas = lista1.filter((x: any) => x.origem === "fixa" && x.descricao === "Netflix");
  assert.equal(geradas.length, 1);
  assert.equal(geradas[0].valor_centimos, 799);

  // Voltar a pedir o mês não duplica
  const lista2 = (await request(app).get(`/api/despesas?mes=${mes}`).set(com(f.codigo))).body;
  assert.equal(lista2.filter((x: any) => x.descricao === "Netflix").length, 1);
});

test("fixas: apagar um participante não parte a geração dos meses seguintes", async () => {
  const f = await novaFamilia("FixaMembro");
  const ana = (await request(app).post("/api/membros").set(com(f.codigo)).send({ nome: "Ana" })).body;
  const rui = (await request(app).post("/api/membros").set(com(f.codigo)).send({ nome: "Rui" })).body;

  await request(app).post("/api/fixas").set(com(f.codigo)).send({
    valor_centimos: 1000, descricao: "Ginásio", categoria_id: null,
    membro_id: ana.id, dia: 1, participantes: [ana.id, rui.id], ativa: true,
  });
  // Simula uma fixa criada há 2 meses (o mês corrente já foi gerado acima).
  await pool.query("UPDATE despesas_fixas SET criado_em = now() - interval '2 months' WHERE familia_id = $1", [f.id]);

  const ap = await request(app).delete(`/api/membros/${rui.id}`).set(com(f.codigo));
  assert.equal(ap.status, 204);

  // Antes da correção isto dava 500 (FK de despesa_membros ao gerar os meses em falta).
  const r = await request(app).get(`/api/resumo?mes=${mesAtualLocal()}`).set(com(f.codigo));
  assert.equal(r.status, 200);
  // 3 meses gerados (há 2 meses, mês passado, este) -> evolução com 3 meses a 10€.
  const comValor = r.body.evolucao.filter((e: any) => e.total === 1000);
  assert.equal(comValor.length, 3);
});

test("orçamentos: definir, ver no resumo e apagar", async () => {
  const f = await novaFamilia("Orc");
  const cats = (await request(app).get("/api/categorias").set(com(f.codigo))).body;
  const sup = cats.find((c: any) => c.nome === "Supermercado");

  const put = await request(app).put("/api/orcamentos").set(com(f.codigo)).send({ categoria_id: sup.id, valor_centimos: 30000 });
  assert.equal(put.status, 200);
  await request(app).put("/api/orcamentos").set(com(f.codigo)).send({ categoria_id: null, valor_centimos: 100000 });

  const mes = mesAtualLocal();
  await request(app).post("/api/despesas").set(com(f.codigo)).send({
    valor_centimos: 12000, descricao: "compras", categoria_id: sup.id, membro_id: null,
    data: `${mes}-03`, origem: "manual", participantes: [],
  });
  const r = (await request(app).get(`/api/resumo?mes=${mes}`).set(com(f.codigo))).body;
  assert.equal(r.orcamentos.length, 2);
  const oSup = r.orcamentos.find((o: any) => o.categoria_id === sup.id);
  const oTot = r.orcamentos.find((o: any) => o.categoria_id === null);
  assert.equal(oSup.gasto, 12000);
  assert.equal(oTot.valor_centimos, 100000);
  assert.equal(oTot.gasto, 12000);

  const del = await request(app).put("/api/orcamentos").set(com(f.codigo)).send({ categoria_id: sup.id, valor_centimos: null });
  assert.equal(del.body.length, 1);
});
