import Database from "better-sqlite3";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Permite definir o caminho da BD por variável de ambiente (útil em hosts com
// disco persistente, ex.: Render/Fly.io). Por omissão fica ao lado do código.
const DB_PATH = process.env.DB_PATH || join(__dirname, "despesas.db");

export const db = new Database(DB_PATH);

// WAL melhora a concorrência de leitura/escrita — bom para uso multi-utilizador.
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ─────────────────────────────────────────────────────────────────────────
// Migrações (idempotentes)
// ─────────────────────────────────────────────────────────────────────────
export function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS membros (
      id   INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS categorias (
      id   INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL UNIQUE,
      cor  TEXT NOT NULL DEFAULT '#64748b'
    );

    CREATE TABLE IF NOT EXISTS despesas (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      valor_centimos INTEGER NOT NULL CHECK (valor_centimos >= 0),
      descricao      TEXT NOT NULL DEFAULT '',
      categoria_id   INTEGER REFERENCES categorias(id) ON DELETE SET NULL,
      membro_id      INTEGER REFERENCES membros(id)    ON DELETE SET NULL,
      data           TEXT NOT NULL,                         -- 'YYYY-MM-DD'
      origem         TEXT NOT NULL DEFAULT 'manual',        -- 'manual' | 'talao'
      criado_em      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_despesas_data      ON despesas(data);
    CREATE INDEX IF NOT EXISTS idx_despesas_categoria ON despesas(categoria_id);
    CREATE INDEX IF NOT EXISTS idx_despesas_membro    ON despesas(membro_id);
  `);

  // Migração suave: se uma BD antiga não tiver a coluna 'origem', acrescenta-a.
  const colunas = db.prepare("PRAGMA table_info(despesas)").all() as Array<{
    name: string;
  }>;
  if (!colunas.some((c) => c.name === "origem")) {
    db.exec("ALTER TABLE despesas ADD COLUMN origem TEXT NOT NULL DEFAULT 'manual'");
  }

  seed();
}

// ─────────────────────────────────────────────────────────────────────────
// Semente inicial: só categorias (membros ficam a cargo do utilizador)
// ─────────────────────────────────────────────────────────────────────────
function seed() {
  const total = db.prepare("SELECT COUNT(*) AS n FROM categorias").get() as {
    n: number;
  };
  if (total.n > 0) return;

  const categoriasIniciais: Array<{ nome: string; cor: string }> = [
    { nome: "Supermercado", cor: "#16a34a" },
    { nome: "Renda", cor: "#7c3aed" },
    { nome: "Contas/Serviços", cor: "#0ea5e9" },
    { nome: "Transportes", cor: "#f59e0b" },
    { nome: "Restauração", cor: "#ef4444" },
    { nome: "Saúde", cor: "#ec4899" },
    { nome: "Lazer", cor: "#14b8a6" },
    { nome: "Outros", cor: "#64748b" },
  ];

  const insert = db.prepare("INSERT INTO categorias (nome, cor) VALUES (@nome, @cor)");
  const inserirTodas = db.transaction((linhas: typeof categoriasIniciais) => {
    for (const c of linhas) insert.run(c);
  });
  inserirTodas(categoriasIniciais);
}
