-- ============================================================================
-- Despesas da Casa — esquema da base de dados (Postgres / Supabase)
-- ----------------------------------------------------------------------------
-- Como usar no Supabase:
--   1. Abre o teu projeto → SQL Editor → New query
--   2. Cola TODO este ficheiro e carrega em "Run"
--   3. Copia a Connection string (Project Settings → Database) para a DATABASE_URL
--
-- É idempotente (CREATE ... IF NOT EXISTS): podes correr mais que uma vez sem erro.
-- A app cria isto automaticamente na 1.ª ligação; este ficheiro é para o fazeres
-- diretamente no Supabase.
-- ============================================================================

-- Famílias (cada casa tem um código único para os membros entrarem)
CREATE TABLE IF NOT EXISTS familias (
  id        SERIAL PRIMARY KEY,
  codigo    TEXT NOT NULL UNIQUE,
  nome      TEXT NOT NULL DEFAULT 'A nossa casa',
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Membros da casa (pertencem a uma família)
CREATE TABLE IF NOT EXISTS membros (
  id         SERIAL PRIMARY KEY,
  familia_id INTEGER NOT NULL REFERENCES familias(id) ON DELETE CASCADE,
  nome       TEXT NOT NULL,
  UNIQUE (familia_id, nome)
);

-- Categorias de despesa (por família; cada uma com uma cor)
CREATE TABLE IF NOT EXISTS categorias (
  id         SERIAL PRIMARY KEY,
  familia_id INTEGER NOT NULL REFERENCES familias(id) ON DELETE CASCADE,
  nome       TEXT NOT NULL,
  cor        TEXT NOT NULL DEFAULT '#64748b',
  UNIQUE (familia_id, nome)
);

-- Despesas (valor em CÊNTIMOS, inteiro — sem erros de vírgula flutuante)
CREATE TABLE IF NOT EXISTS despesas (
  id             SERIAL PRIMARY KEY,
  familia_id     INTEGER NOT NULL REFERENCES familias(id) ON DELETE CASCADE,
  valor_centimos INTEGER NOT NULL CHECK (valor_centimos >= 0),
  descricao      TEXT NOT NULL DEFAULT '',
  categoria_id   INTEGER REFERENCES categorias(id) ON DELETE SET NULL,
  membro_id      INTEGER REFERENCES membros(id)    ON DELETE SET NULL,  -- quem pagou
  data           TEXT NOT NULL,                                         -- 'YYYY-MM-DD'
  origem         TEXT NOT NULL DEFAULT 'manual',                        -- 'manual' | 'talao'
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Participantes de cada despesa (quem divide o custo — para "acertar contas")
CREATE TABLE IF NOT EXISTS despesa_membros (
  despesa_id INTEGER NOT NULL REFERENCES despesas(id) ON DELETE CASCADE,
  membro_id  INTEGER NOT NULL REFERENCES membros(id)  ON DELETE CASCADE,
  PRIMARY KEY (despesa_id, membro_id)
);

-- Índices (desempenho das consultas mais comuns)
CREATE INDEX IF NOT EXISTS idx_despesas_familia    ON despesas(familia_id, data);
CREATE INDEX IF NOT EXISTS idx_despesas_categoria  ON despesas(categoria_id);
CREATE INDEX IF NOT EXISTS idx_despesas_membro     ON despesas(membro_id);
CREATE INDEX IF NOT EXISTS idx_membros_familia     ON membros(familia_id);
CREATE INDEX IF NOT EXISTS idx_categorias_familia  ON categorias(familia_id);
CREATE INDEX IF NOT EXISTS idx_despmembros_despesa ON despesa_membros(despesa_id);
CREATE INDEX IF NOT EXISTS idx_despmembros_membro  ON despesa_membros(membro_id);

-- Pronto! As categorias predefinidas (Supermercado, Renda, etc.) são criadas
-- automaticamente pela app sempre que crias uma família nova — não é preciso
-- inserir nada à mão aqui.
