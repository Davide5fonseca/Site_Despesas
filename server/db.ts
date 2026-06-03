import Database from "better-sqlite3";
import { randomInt } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || join(__dirname, "despesas.db");

export const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ─────────────────────────────────────────────────────────────────────────
// Categorias predefinidas (criadas por família)
// ─────────────────────────────────────────────────────────────────────────
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

// Código de família curto e legível (sem caracteres ambíguos: 0/O, 1/I/L).
const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function gerarCodigo(tamanho = 6): string {
  let s = "";
  for (let i = 0; i < tamanho; i++) s += ALFABETO[randomInt(ALFABETO.length)];
  return s;
}
function gerarCodigoUnico(): string {
  for (let i = 0; i < 20; i++) {
    const c = gerarCodigo();
    const existe = db.prepare("SELECT 1 FROM familias WHERE codigo = ?").get(c);
    if (!existe) return c;
  }
  // Fallback improvável: alarga o tamanho
  return gerarCodigo(8);
}

// ─────────────────────────────────────────────────────────────────────────
// Helpers de utilidade
// ─────────────────────────────────────────────────────────────────────────
function tabelaExiste(nome: string): boolean {
  return !!db
    .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name = ?")
    .get(nome);
}
function temColuna(tabela: string, coluna: string): boolean {
  const cols = db.prepare(`PRAGMA table_info(${tabela})`).all() as Array<{ name: string }>;
  return cols.some((c) => c.name === coluna);
}

export interface Familia {
  id: number;
  codigo: string;
  nome: string;
}

export function seedCategoriasParaFamilia(familiaId: number) {
  const insert = db.prepare(
    "INSERT INTO categorias (familia_id, nome, cor) VALUES (@familia_id, @nome, @cor)"
  );
  const tx = db.transaction((linhas: typeof CATEGORIAS_INICIAIS) => {
    for (const c of linhas) insert.run({ familia_id: familiaId, ...c });
  });
  tx(CATEGORIAS_INICIAIS);
}

export function criarFamilia(nome: string): Familia {
  const codigo = gerarCodigoUnico();
  const info = db
    .prepare("INSERT INTO familias (codigo, nome) VALUES (?, ?)")
    .run(codigo, nome.trim() || "A nossa casa");
  const id = Number(info.lastInsertRowid);
  seedCategoriasParaFamilia(id);
  return { id, codigo, nome: nome.trim() || "A nossa casa" };
}

export function obterFamiliaPorCodigo(codigo: string): Familia | undefined {
  return db
    .prepare("SELECT id, codigo, nome FROM familias WHERE codigo = ?")
    .get(codigo.trim().toUpperCase()) as Familia | undefined;
}

// ─────────────────────────────────────────────────────────────────────────
// Migrações
// ─────────────────────────────────────────────────────────────────────────
export function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS familias (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo    TEXT NOT NULL UNIQUE,
      nome      TEXT NOT NULL DEFAULT 'A nossa casa',
      criado_em TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Esquema antigo (sem famílias)? -> reconstrói preservando os dados numa
  // família "A nossa casa" e mostra o código gerado nos logs.
  if (tabelaExiste("despesas") && !temColuna("despesas", "familia_id")) {
    migrarEsquemaAntigo();
  }

  // Esquema novo (idempotente)
  db.exec(`
    CREATE TABLE IF NOT EXISTS membros (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      familia_id INTEGER NOT NULL REFERENCES familias(id) ON DELETE CASCADE,
      nome       TEXT NOT NULL,
      UNIQUE (familia_id, nome)
    );

    CREATE TABLE IF NOT EXISTS categorias (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      familia_id INTEGER NOT NULL REFERENCES familias(id) ON DELETE CASCADE,
      nome       TEXT NOT NULL,
      cor        TEXT NOT NULL DEFAULT '#64748b',
      UNIQUE (familia_id, nome)
    );

    CREATE TABLE IF NOT EXISTS despesas (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      familia_id     INTEGER NOT NULL REFERENCES familias(id) ON DELETE CASCADE,
      valor_centimos INTEGER NOT NULL CHECK (valor_centimos >= 0),
      descricao      TEXT NOT NULL DEFAULT '',
      categoria_id   INTEGER REFERENCES categorias(id) ON DELETE SET NULL,
      membro_id      INTEGER REFERENCES membros(id)    ON DELETE SET NULL,
      data           TEXT NOT NULL,
      origem         TEXT NOT NULL DEFAULT 'manual',
      criado_em      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_despesas_familia   ON despesas(familia_id);
    CREATE INDEX IF NOT EXISTS idx_despesas_data      ON despesas(familia_id, data);
    CREATE INDEX IF NOT EXISTS idx_despesas_categoria ON despesas(categoria_id);
    CREATE INDEX IF NOT EXISTS idx_despesas_membro    ON despesas(membro_id);
    CREATE INDEX IF NOT EXISTS idx_membros_familia    ON membros(familia_id);
    CREATE INDEX IF NOT EXISTS idx_categorias_familia ON categorias(familia_id);

    -- Participantes de cada despesa (quem divide o custo) — para "acertar contas".
    CREATE TABLE IF NOT EXISTS despesa_membros (
      despesa_id INTEGER NOT NULL REFERENCES despesas(id) ON DELETE CASCADE,
      membro_id  INTEGER NOT NULL REFERENCES membros(id)  ON DELETE CASCADE,
      PRIMARY KEY (despesa_id, membro_id)
    );
    CREATE INDEX IF NOT EXISTS idx_despmembros_despesa ON despesa_membros(despesa_id);
    CREATE INDEX IF NOT EXISTS idx_despmembros_membro  ON despesa_membros(membro_id);
  `);
}

// Reconstrói as tabelas antigas (globais) movendo tudo para uma família única.
function migrarEsquemaAntigo() {
  const codigo = gerarCodigoUnico();
  db.pragma("foreign_keys = OFF");
  const tx = db.transaction(() => {
    const info = db
      .prepare("INSERT INTO familias (codigo, nome) VALUES (?, ?)")
      .run(codigo, "A nossa casa");
    const fid = Number(info.lastInsertRowid);

    // categorias
    db.exec("ALTER TABLE categorias RENAME TO categorias_old;");
    db.exec(`
      CREATE TABLE categorias (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        familia_id INTEGER NOT NULL REFERENCES familias(id) ON DELETE CASCADE,
        nome TEXT NOT NULL, cor TEXT NOT NULL DEFAULT '#64748b',
        UNIQUE (familia_id, nome)
      );`);
    db.prepare(
      "INSERT INTO categorias (id, familia_id, nome, cor) SELECT id, ?, nome, cor FROM categorias_old"
    ).run(fid);
    db.exec("DROP TABLE categorias_old;");

    // membros
    db.exec("ALTER TABLE membros RENAME TO membros_old;");
    db.exec(`
      CREATE TABLE membros (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        familia_id INTEGER NOT NULL REFERENCES familias(id) ON DELETE CASCADE,
        nome TEXT NOT NULL,
        UNIQUE (familia_id, nome)
      );`);
    db.prepare(
      "INSERT INTO membros (id, familia_id, nome) SELECT id, ?, nome FROM membros_old"
    ).run(fid);
    db.exec("DROP TABLE membros_old;");

    // despesas
    db.exec("ALTER TABLE despesas RENAME TO despesas_old;");
    db.exec(`
      CREATE TABLE despesas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        familia_id INTEGER NOT NULL REFERENCES familias(id) ON DELETE CASCADE,
        valor_centimos INTEGER NOT NULL CHECK (valor_centimos >= 0),
        descricao TEXT NOT NULL DEFAULT '',
        categoria_id INTEGER REFERENCES categorias(id) ON DELETE SET NULL,
        membro_id INTEGER REFERENCES membros(id) ON DELETE SET NULL,
        data TEXT NOT NULL, origem TEXT NOT NULL DEFAULT 'manual',
        criado_em TEXT NOT NULL DEFAULT (datetime('now'))
      );`);
    db.prepare(
      `INSERT INTO despesas (id, familia_id, valor_centimos, descricao, categoria_id, membro_id, data, origem, criado_em)
       SELECT id, ?, valor_centimos, descricao, categoria_id, membro_id, data,
              COALESCE(origem,'manual'), criado_em FROM despesas_old`
    ).run(fid);
    db.exec("DROP TABLE despesas_old;");
  });
  tx();
  db.pragma("foreign_keys = ON");
  console.log(`↻ Esquema migrado para famílias. Código da família existente: ${codigo}`);
}
