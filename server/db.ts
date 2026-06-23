import pg from "pg";
import { randomInt } from "node:crypto";
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

// ── Migração (cria tabelas se não existirem) ───────────────────────────────
export async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS familias (
      id        SERIAL PRIMARY KEY,
      codigo    TEXT NOT NULL UNIQUE,
      nome      TEXT NOT NULL DEFAULT 'A nossa casa',
      pin_hash  TEXT,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    ALTER TABLE familias ADD COLUMN IF NOT EXISTS pin_hash TEXT;

    CREATE TABLE IF NOT EXISTS membros (
      id         SERIAL PRIMARY KEY,
      familia_id INTEGER NOT NULL REFERENCES familias(id) ON DELETE CASCADE,
      nome       TEXT NOT NULL,
      UNIQUE (familia_id, nome)
    );

    CREATE TABLE IF NOT EXISTS categorias (
      id         SERIAL PRIMARY KEY,
      familia_id INTEGER NOT NULL REFERENCES familias(id) ON DELETE CASCADE,
      nome       TEXT NOT NULL,
      cor        TEXT NOT NULL DEFAULT '#64748b',
      UNIQUE (familia_id, nome)
    );

    CREATE TABLE IF NOT EXISTS despesas (
      id             SERIAL PRIMARY KEY,
      familia_id     INTEGER NOT NULL REFERENCES familias(id) ON DELETE CASCADE,
      valor_centimos INTEGER NOT NULL CHECK (valor_centimos >= 0),
      descricao      TEXT NOT NULL DEFAULT '',
      categoria_id   INTEGER REFERENCES categorias(id) ON DELETE SET NULL,
      membro_id      INTEGER REFERENCES membros(id)    ON DELETE SET NULL,
      data           TEXT NOT NULL,
      origem         TEXT NOT NULL DEFAULT 'manual',
      criado_em      TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS despesa_membros (
      despesa_id INTEGER NOT NULL REFERENCES despesas(id) ON DELETE CASCADE,
      membro_id  INTEGER NOT NULL REFERENCES membros(id)  ON DELETE CASCADE,
      PRIMARY KEY (despesa_id, membro_id)
    );

    -- Despesas fixas / subscrições (modelo que gera uma despesa por mês)
    CREATE TABLE IF NOT EXISTS despesas_fixas (
      id             SERIAL PRIMARY KEY,
      familia_id     INTEGER NOT NULL REFERENCES familias(id) ON DELETE CASCADE,
      valor_centimos INTEGER NOT NULL CHECK (valor_centimos >= 0),
      descricao      TEXT NOT NULL DEFAULT '',
      categoria_id   INTEGER REFERENCES categorias(id) ON DELETE SET NULL,
      membro_id      INTEGER REFERENCES membros(id)    ON DELETE SET NULL,
      dia            INTEGER NOT NULL DEFAULT 1 CHECK (dia >= 1 AND dia <= 31),
      participantes  INTEGER[] NOT NULL DEFAULT '{}',
      ativa          BOOLEAN NOT NULL DEFAULT true,
      criado_em      TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    ALTER TABLE despesas ADD COLUMN IF NOT EXISTS despesa_fixa_id INTEGER REFERENCES despesas_fixas(id) ON DELETE SET NULL;

    -- Registo de que mês de cada fixa já foi gerado (evita duplicar)
    CREATE TABLE IF NOT EXISTS geracoes_fixas (
      despesa_fixa_id INTEGER NOT NULL REFERENCES despesas_fixas(id) ON DELETE CASCADE,
      mes             TEXT NOT NULL,
      despesa_id      INTEGER REFERENCES despesas(id) ON DELETE SET NULL,
      PRIMARY KEY (despesa_fixa_id, mes)
    );
    CREATE INDEX IF NOT EXISTS idx_fixas_familia ON despesas_fixas(familia_id);

    CREATE INDEX IF NOT EXISTS idx_despesas_familia   ON despesas(familia_id, data);
    CREATE INDEX IF NOT EXISTS idx_despesas_categoria ON despesas(categoria_id);
    CREATE INDEX IF NOT EXISTS idx_despesas_membro    ON despesas(membro_id);
    CREATE INDEX IF NOT EXISTS idx_membros_familia    ON membros(familia_id);
    CREATE INDEX IF NOT EXISTS idx_categorias_familia ON categorias(familia_id);
    CREATE INDEX IF NOT EXISTS idx_despmembros_despesa ON despesa_membros(despesa_id);
    CREATE INDEX IF NOT EXISTS idx_despmembros_membro  ON despesa_membros(membro_id);
  `);
}
