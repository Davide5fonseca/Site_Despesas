import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";

// Modo de teste + base de dados de teste (Postgres em Docker), definidos ANTES
// de importar a app (db.ts cria o pool no import). dotenv não sobrepõe estes.
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgres://postgres:postgres@localhost:5433/despesas";

const { app } = await import("../index.ts");
const { migrate, pool } = await import("../db.ts");

const com = (codigo: string) => ({ "x-familia-codigo": codigo });

async function novaFamilia(nome = "Casa", pin?: string) {
  const r = await request(app).post("/api/familias").send({ nome, pin });
  return r.body as { id: number; codigo: string; nome: string };
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

test("cria família com código de 8 caracteres", async () => {
  const r = await request(app).post("/api/familias").send({ nome: "Casa A" });
  assert.equal(r.status, 201);
  assert.equal(r.body.codigo.length, 8);
});

test("PIN: bloqueia sem PIN, rejeita errado, aceita certo (sem expor hash)", async () => {
  const f = await novaFamilia("ComPin", "1234");
  const semPin = await request(app).post("/api/familias/entrar").send({ codigo: f.codigo });
  assert.equal(semPin.status, 401);
  assert.equal(semPin.body.pinNecessario, true);

  const errado = await request(app).post("/api/familias/entrar").send({ codigo: f.codigo, pin: "0000" });
  assert.equal(errado.status, 401);

  const certo = await request(app).post("/api/familias/entrar").send({ codigo: f.codigo, pin: "1234" });
  assert.equal(certo.status, 200);
  assert.equal(certo.body.codigo, f.codigo);
  assert.equal(certo.body.pin_hash, undefined);
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

  const d = new Date();
  const mes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

  const lista1 = (await request(app).get(`/api/despesas?mes=${mes}`).set(com(f.codigo))).body;
  const geradas = lista1.filter((x: any) => x.origem === "fixa" && x.descricao === "Netflix");
  assert.equal(geradas.length, 1);
  assert.equal(geradas[0].valor_centimos, 799);

  // Voltar a pedir o mês não duplica
  const lista2 = (await request(app).get(`/api/despesas?mes=${mes}`).set(com(f.codigo))).body;
  assert.equal(lista2.filter((x: any) => x.descricao === "Netflix").length, 1);
});
