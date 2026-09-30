-- ============================================================================
-- ScanWise — esquema da base de dados (Postgres / Neon / Supabase)
-- ----------------------------------------------------------------------------
-- FONTE ÚNICA do esquema: a app lê este ficheiro e aplica-o em cada arranque
-- (ver migrate() em db.ts). Também o podes colar no SQL Editor do Supabase.
--
-- É idempotente (CREATE ... IF NOT EXISTS / ADD COLUMN IF NOT EXISTS): corre
-- quantas vezes quiseres sem erro. Alterações futuras: acrescenta-as no fim,
-- sempre de forma idempotente.
-- ============================================================================

-- Famílias / grupos (cada um tem um código único para os membros entrarem)
CREATE TABLE IF NOT EXISTS familias (
  id        SERIAL PRIMARY KEY,
  codigo    TEXT NOT NULL UNIQUE,
  nome      TEXT NOT NULL DEFAULT 'A nossa casa',
  pin_hash  TEXT,                                 -- PIN opcional (hash bcrypt)
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE familias ADD COLUMN IF NOT EXISTS pin_hash TEXT;

-- Rendimento mensal (para calcular a poupança). NULL = não definido.
ALTER TABLE familias ADD COLUMN IF NOT EXISTS rendimento_centimos INTEGER;

-- Sessões de grupos com PIN: quem entra com código + PIN recebe um token.
-- Guarda-se só o hash (sha256) do token.
CREATE TABLE IF NOT EXISTS sessoes (
  token_hash TEXT PRIMARY KEY,
  familia_id INTEGER NOT NULL REFERENCES familias(id) ON DELETE CASCADE,
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Membros (pertencem a uma família)
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
  origem         TEXT NOT NULL DEFAULT 'manual',                        -- 'manual' | 'talao' | 'fixa'
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Participantes de cada despesa (quem divide o custo — para "acertar contas")
CREATE TABLE IF NOT EXISTS despesa_membros (
  despesa_id INTEGER NOT NULL REFERENCES despesas(id) ON DELETE CASCADE,
  membro_id  INTEGER NOT NULL REFERENCES membros(id)  ON DELETE CASCADE,
  PRIMARY KEY (despesa_id, membro_id)
);

-- Despesas fixas / subscrições (geram uma despesa por mês)
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

-- Chave única do talão (ATCUD/nº doc do QR fiscal), para detetar duplicados.
-- NULL em despesas manuais/sem QR. Índice NÃO único (avisamos, não bloqueamos).
ALTER TABLE despesas ADD COLUMN IF NOT EXISTS talao_id TEXT;

-- Id gerado no cliente (idempotência da captura offline). Único por grupo
-- quando presente; NULL nas despesas antigas/sem captura offline.
ALTER TABLE despesas ADD COLUMN IF NOT EXISTS cliente_id TEXT;

-- IVA em cêntimos (do QR fiscal), para o relatório. NULL em manuais/sem QR.
ALTER TABLE despesas ADD COLUMN IF NOT EXISTS iva_centimos INTEGER;

-- Registo de que mês de cada fixa já foi gerado (evita duplicar)
CREATE TABLE IF NOT EXISTS geracoes_fixas (
  despesa_fixa_id INTEGER NOT NULL REFERENCES despesas_fixas(id) ON DELETE CASCADE,
  mes             TEXT NOT NULL,
  despesa_id      INTEGER REFERENCES despesas(id) ON DELETE SET NULL,
  PRIMARY KEY (despesa_fixa_id, mes)
);

-- Orçamentos mensais: por categoria, ou total (categoria_id NULL).
CREATE TABLE IF NOT EXISTS orcamentos (
  familia_id     INTEGER NOT NULL REFERENCES familias(id) ON DELETE CASCADE,
  categoria_id   INTEGER REFERENCES categorias(id) ON DELETE CASCADE,
  valor_centimos INTEGER NOT NULL CHECK (valor_centimos > 0)
);

-- Índices (desempenho das consultas mais comuns)
CREATE INDEX IF NOT EXISTS idx_despesas_familia    ON despesas(familia_id, data);
CREATE INDEX IF NOT EXISTS idx_despesas_categoria  ON despesas(categoria_id);
CREATE INDEX IF NOT EXISTS idx_despesas_membro     ON despesas(membro_id);
CREATE INDEX IF NOT EXISTS idx_membros_familia     ON membros(familia_id);
CREATE INDEX IF NOT EXISTS idx_categorias_familia  ON categorias(familia_id);
CREATE INDEX IF NOT EXISTS idx_despmembros_despesa ON despesa_membros(despesa_id);
CREATE INDEX IF NOT EXISTS idx_despmembros_membro  ON despesa_membros(membro_id);
CREATE INDEX IF NOT EXISTS idx_fixas_familia       ON despesas_fixas(familia_id);
CREATE INDEX IF NOT EXISTS idx_despesas_talao      ON despesas(familia_id, talao_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_despesas_cliente ON despesas(familia_id, cliente_id) WHERE cliente_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sessoes_familia     ON sessoes(familia_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_orcamentos_unico ON orcamentos(familia_id, COALESCE(categoria_id, 0));

-- As categorias predefinidas (Supermercado, Renda, etc.) são criadas pela app
-- sempre que se cria uma família nova — não é preciso inserir nada aqui.
