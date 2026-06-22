import { chromium } from "playwright";

// Reutiliza a família de teste já criada (com dados) — não cria nova.
const fam = { id: 1, codigo: process.argv[2] || "8CDXH6", nome: "Teste UI" };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await ctx.addInitScript((f) => {
  localStorage.setItem("despesas_familia", JSON.stringify(f));
  localStorage.setItem("despesas_tema", "light");
}, fam);
const page = await ctx.newPage();
await page.goto("http://localhost:5173/inicio", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
await page.screenshot({ path: "scr-inicio.png" });
await browser.close();
console.log("done");
