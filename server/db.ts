import pg from "pg";
import { randomInt, randomBytes, createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Request, Response, NextFunction, RequestHandler } from "express";

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error(
    "DATABASE_URL em falta. Define a connection string do Postgres no .env " +
      "(ex.: postgres://user:pass@host:5432/base). Vê o README (Neon/Supabase)."
  );
}

// SSL é exigido por Neon/Supabase (hosts remotos); local (localhost) dispensa.
const local = /@(localhost|127\.0\.0\.1)[:/]/.test(DATABASE_URL);
export const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: local ? undefined : { rejectUnauthorized: false },
  // Gentil com o limite de ligações do Supabase free; falha rápido se a ligação
  // estalar (em vez de ficar pendurada e bloquear o arranque/deploy).
  max: 5,
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 30_000,
});

// ── Helpers de query ───────────────────────────────────────────────────────
export async function q<T = any>(text: string, params: any[] = []): Promise<T[]> {
  const r = await pool.query(text, params);
  return r.rows as T[];
}
export async function um<T = any>(text: string, params: any[] = []): Promise<T | undefined> {
  const r = await pool.query(text, params);
  return r.rows[0] as T | undefined;
}
export async function tx<T>(fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const r = await fn(c);
    await c.query("COMMIT");
    return r;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}

// Embrulha handlers async para que erros vão ao middleware de erros do Express.
export const ah =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>): RequestHandler =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

export const ERRO_UNICO = "23505"; // código Postgres de violação UNIQUE

// A base de dados está inacessível? (projeto Supabase pausado, DNS, rede,
// pooler cheio…) — distinto de um erro de SQL nosso.
export function erroDeLigacao(e: any): boolean {
  const codigo = String(e?.code ?? "");
  if (["ENOTFOUND", "ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "EAI_AGAIN", "57P01", "53300", "08006", "08001"].includes(codigo)) {
    return true;
  }
  const msg = String(e?.message ?? "").toLowerCase();
  return (
    /tenant|not found|timeout exceeded when trying to connect|connection terminated|too many connections/.test(msg) &&
    (codigo === "XX000" || codigo === "" || e?.severity === "FATAL")
  );
}

// Verifica a ligação (para /api/saude), com limite de tempo curto e sem
// lançar: devolve true/false.
export async function bdDisponivel(ms = 3000): Promise<boolean> {
  try {
    await Promise.race([
      pool.query("SELECT 1"),
      new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms)),
    ]);
    return true;
  } catch {
    return false;
  }
}

// ── Categorias predefinidas (criadas por família) ──────────────────────────
const CATEGORIAS_INICIAIS: Array<{ nome: string; cor: string }> = [
  { nome: "Supermercado", cor: "#16a34a" },
  { nome: "Renda", cor: "#7c3aed" },
  { nome: "Contas/Serviços", cor: "#0ea5e9" },
  { nome: "Transportes", cor: "#f59e0b" },
  { nome: "Restauração", cor: "#ef4444" },
  { nome: "Saúde", cor: "#ec4899" },
  { nome: "Lazer", cor: "#14b8a6" },
  { nome: "Outros", cor: "#64748b" },
];

const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function gerarCodigo(tamanho = 8): string {
  let s = "";
  for (let i = 0; i < tamanho; i++) s += ALFABETO[randomInt(ALFABETO.length)];
  return s;
}
async function gerarCodigoUnico(): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const c = gerarCodigo();
    const existe = await um("SELECT 1 FROM familias WHERE codigo = $1", [c]);
    if (!existe) return c;
  }
  return gerarCodigo(8);
}

export interface Familia {
  id: number;
  codigo: string;
  nome: string;
}

export interface FamiliaComPin extends Familia {
  pin_hash: string | null;
}

export async function seedCategoriasParaFamilia(familiaId: number, c?: pg.PoolClient) {
  const exec = c ?? pool;
  for (const cat of CATEGORIAS_INICIAIS) {
    await exec.query("INSERT INTO categorias (familia_id, nome, cor) VALUES ($1, $2, $3)", [
      familiaId,
      cat.nome,
      cat.cor,
    ]);
  }
}

export async function criarFamilia(nome: string, pinHash: string | null = null): Promise<Familia> {
  const nomeFinal = nome.trim() || "A nossa casa";
  return tx(async (c) => {
    const codigo = await gerarCodigoUnico();
    const fam = (
      await c.query<Familia>(
        "INSERT INTO familias (codigo, nome, pin_hash) VALUES ($1, $2, $3) RETURNING id, codigo, nome",
        [codigo, nomeFinal, pinHash]
      )
    ).rows[0];
    await seedCategoriasParaFamilia(fam.id, c);
    return fam;
  });
}

export async function obterFamiliaPorCodigo(codigo: string): Promise<Familia | undefined> {
  return um<Familia>("SELECT id, codigo, nome FROM familias WHERE codigo = $1", [
    codigo.trim().toUpperCase(),
  ]);
}

// Inclui o pin_hash — apenas para validação no servidor (nunca devolvido ao cliente).
export async function obterFamiliaComPin(codigo: string): Promise<FamiliaComPin | undefined> {
  return um<FamiliaComPin>(
    "SELECT id, codigo, nome, pin_hash FROM familias WHERE codigo = $1",
    [codigo.trim().toUpperCase()]
  );
}

// Apaga o grupo e tudo o que lhe pertence (cascata via ON DELETE CASCADE).
export async function apagarFamiliaPorCodigo(codigo: string): Promise<boolean> {
  const r = await pool.query("DELETE FROM familias WHERE codigo = $1", [
    codigo.trim().toUpperCase(),
  ]);
  return (r.rowCount ?? 0) > 0;
}

// Nº de membros de um grupo (para proteger o DELETE: só apaga grupos individuais).
export async function contarMembros(familiaId: number): Promise<number> {
  const r = await um<{ n: number }>(
    "SELECT COUNT(*)::int AS n FROM membros WHERE familia_id = $1",
    [familiaId]
  );
  return r ? Number(r.n) : 0;
}

// ── Sessões (grupos com PIN) ────────────────────────────────────────────────
// Quem entra com código + PIN recebe um token aleatório; guardamos só o hash.
// Nos grupos com PIN, as rotas de dados exigem este token (o código sozinho
// não chega — é o que se partilha para convidar).
const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

export async function criarSessao(familiaId: number, c?: pg.PoolClient): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await (c ?? pool).query("INSERT INTO sessoes (token_hash, familia_id) VALUES ($1, $2)", [
    hashToken(token),
    familiaId,
  ]);
  return token;
}

export async function sessaoValida(familiaId: number, token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const r = await um("SELECT 1 FROM sessoes WHERE token_hash = $1 AND familia_id = $2", [
    hashToken(token),
    familiaId,
  ]);
  return Boolean(r);
}

// ── Migração ───────────────────────────────────────────────────────────────
// O schema.sql é a fonte única do esquema (idempotente); aplica-o tal como está.
const SCHEMA = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "schema.sql"), "utf8");

export async function migrate() {
  await pool.query(SCHEMA);
}
