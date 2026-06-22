import { chromium } from "playwright";

const API = "http://localhost:3001/api";
const j = (r) => r.json();

// 1) Família + dados de teste
const fam = await j(
  await fetch(`${API}/familias`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nome: "Teste UI" }),
  })
);
const H = { "Content-Type": "application/json", "x-familia-codigo": fam.codigo };
const ana = await j(await fetch(`${API}/membros`, { method: "POST", headers: H, body: JSON.stringify({ nome: "Ana" }) }));
const ze = await j(await fetch(`${API}/membros`, { method: "POST", headers: H, body: JSON.stringify({ nome: "Zé" }) }));
const cats = await j(await fetch(`${API}/categorias`, { headers: H }));
const cat = (n) => cats.find((c) => c.nome === n)?.id ?? cats[0].id;
const hoje = "2026-06-22";
const ontem = "2026-06-21";
async function desp(v, d, c, m, data = hoje) {
  await fetch(`${API}/despesas`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ valor_centimos: v, descricao: d, categoria_id: c, membro_id: m, data, origem: "manual", participantes: [ana.id, ze.id] }),
  });
}
await desp(1099, "Gasóleo", cat("Transportes"), ze.id);
await desp(500, "Carregamento Telemóvel", cat("Contas/Serviços"), ana.id);
await desp(3250, "Compras Continente", cat("Supermercado"), ana.id, ontem);
await desp(1480, "Jantar fora", cat("Restauração"), ze.id, ontem);

// 2) Screenshots mobile
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await ctx.addInitScript((f) => {
  localStorage.setItem("despesas_familia", JSON.stringify(f));
  localStorage.setItem("despesas_tema", "light");
}, { id: fam.id, codigo: fam.codigo, nome: fam.nome });
const page = await ctx.newPage();
const base = "http://localhost:5173";
async function shot(path, file) {
  await page.goto(base + path, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1400);
  await page.screenshot({ path: file });
}
await shot("/inicio", "scr-inicio.png");
await shot("/resumo", "scr-resumo.png");
await shot("/pessoas", "scr-pessoas.png");
await shot("/definicoes", "scr-definicoes.png");
await browser.close();
console.log("OK codigo=" + fam.codigo);
