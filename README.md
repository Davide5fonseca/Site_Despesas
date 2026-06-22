# 🏠 Despesas da Casa

Aplicação web **PWA** (instalável no telemóvel, sem app store) para **registo de
despesas partilhado** de uma casa/família. Várias pessoas registam o que gastam e
veem, de forma clara, **para onde vai o dinheiro por categoria, por mês e por
pessoa**.

✨ Destaque: **fotografa o talão** e a IA (Anthropic, com visão) extrai
**valor, loja, data** e sugere a **categoria**. Tu confirmas/corriges e gravas.
Também há entrada manual.

```
┌──────────────┐      ┌────────────────────┐      ┌──────────────────────┐
│  React + PWA │ ───▶ │ Express (API REST) │ ───▶ │ Postgres (Neon/Supabase) │
│  (telemóvel) │      │  /api/talao/ler ───────────▶ Anthropic (visão)     │
└──────────────┘      └────────────────────┘      └──────────────────────┘
```

- **Frontend:** React 18 + Vite + TypeScript, Tailwind CSS, Recharts (donut + barras),
  React Router (Resumo / Movimentos / Pessoas / Definições), `vite-plugin-pwa`.
- **Backend:** Node.js + Express, **Postgres via `pg`**, validação com Zod,
  `@anthropic-ai/sdk` (leitura de talões), `multer` (upload da foto).
- **Dinheiro guardado em cêntimos (inteiros)** — sem erros de vírgula flutuante.

> **Modelo de IA usado:** `claude-sonnet-4-6` (Claude Sonnet 4.6) — o Sonnet mais
> recente, com **visão**, rápido e bem mais barato que o Opus para OCR de talões.
> Configurável em `ANTHROPIC_MODEL`.

---

## 📁 Estrutura

```
teste3/
├── server/                 # API + base de dados + IA
│   ├── index.ts            # Express, rotas, CORS
│   ├── db.ts               # Postgres (pg) + migrações + seed de categorias
│   ├── lib/anthropic.ts    # cliente Anthropic + extração estruturada do talão
│   ├── routes/             # despesas, categorias, membros, resumo, saldos, talao, familias
│   └── .env.example        # → copia para .env (DATABASE_URL + chave IA)
└── client/                 # PWA React
    ├── src/
    │   ├── api/client.ts   # fetch tipado para a API
    │   ├── lib/            # format.ts (€ pt-PT, datas) + imagem.ts (compressão)
    │   ├── pages/          # Resumo, Movimentos, Definicoes
    │   └── components/     # FormDespesa, ScanTalao, gráficos, lista, filtros…
    ├── public/icons/       # ícones PWA 192/512/maskable
    ├── scripts/generate-icons.mjs  # (re)gera os ícones sem dependências
    └── vite.config.ts      # proxy /api → backend + configuração PWA
```

---

## 1) 🚀 Correr localmente (PC)

Precisas de **Node.js 18+** (testado com Node 24). Abre **dois terminais**.

### A. Backend

```bash
cd server
npm install
copy .env.example .env        # Windows (PowerShell/cmd)
# cp .env.example .env        # macOS/Linux
```

Edita `server/.env` e mete a **base de dados** (obrigatório) e, se quiseres, a chave de IA:

```
DATABASE_URL=postgres://utilizador:senha@host:5432/base?sslmode=require
ANTHROPIC_API_KEY=        # opcional (ver abaixo)
```

**Base de dados (grátis, persistente):** cria um Postgres em
**[Neon](https://neon.tech)** (recomendado) ou **[Supabase](https://supabase.com)**:
1. Cria conta → novo projeto → copia a **Connection string** (Neon dá-a logo;
   no Supabase é em *Project Settings → Database → Connection string → URI*).
2. Cola-a em `DATABASE_URL`. As tabelas são criadas **automaticamente** no 1.º arranque.

> 💡 Para desenvolvimento sem conta na nuvem, podes correr um Postgres local com
> Docker: `docker run -d -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=despesas -p 5433:5432 postgres:16`
> e usar `DATABASE_URL=postgres://postgres:postgres@localhost:5433/despesas`.

**Leitura de talões por IA (opcional):** mete `ANTHROPIC_API_KEY` (de
<https://console.anthropic.com/> → *Settings → API Keys*). A chave vive **só no
servidor**. **Sem chave a app funciona à mesma** — a leitura de talões passa a
usar o **OCR do telemóvel** (grátis); a entrada manual também continua a funcionar.

Arranca a API:

```bash
npm run dev          # http://localhost:3001  (recarrega ao guardar)
```

### B. Frontend

No outro terminal:

```bash
cd client
npm install
npm run dev          # http://localhost:5173
```

Abre **<http://localhost:5173>** no browser. O Vite encaminha automaticamente os
pedidos `/api` para o backend (porta 3001).

> Os ícones da PWA já vêm gerados. Para os recriar: `node scripts/generate-icons.mjs`.

---

## 2) 📶 Abrir no telemóvel (mesma rede Wi-Fi)

O PC e o telemóvel têm de estar **na mesma rede Wi-Fi**.

**Descobrir o IP do PC:**

- **Windows:** `ipconfig` → procura *Endereço IPv4* (algo como `192.168.1.42`).
- **macOS:** `ipconfig getifaddr en0`
- **Linux:** `hostname -I`

No telemóvel, abre no browser:

```
http://192.168.1.42:5173        ← troca pelo TEU IP
```

O servidor Vite já está configurado com `host: true`, e o proxy `/api` corre no
PC — por isso o telemóvel fala com o backend através do PC, **sem mais
configuração**.

> ⚠️ **Câmara / leitura de talões no telemóvel:** os browsers só permitem aceder
> à câmara em **HTTPS** (ou em `localhost`). Em `http://192.168.x.x` o botão de
> foto pode abrir a galeria mas **não a câmara**, e no iPhone a leitura pode ser
> bloqueada. Para testar a foto a sério, usa HTTPS — vê a secção 3, ou um túnel
> rápido:
>
> ```bash
> npx localtunnel --port 5173      # dá-te um URL https://… temporário
> # alternativa: npx cloudflared tunnel --url http://localhost:5173
> ```
>
> Abre o URL `https://…` no telemóvel e a câmara já funciona.

---

## 3) 🌐 Colocar online em HTTPS de graça (instalar a sério como PWA)

A PWA precisa de **HTTPS** para instalar no iPhone e para usar a câmara.

### 3.1 Tudo no Render — **um único serviço** (recomendado)

O backend Express serve **a API e o frontend compilado** na mesma origem — por
isso é só **1 URL**, sem CORS e sem `VITE_API_URL`. Os dados ficam num **Postgres
externo** (Neon/Supabase), por isso **persistem mesmo no plano gratuito** do Render
(não é preciso disco). O ficheiro [`render.yaml`](render.yaml) já configura tudo.

1. Cria a base de dados em **[Neon](https://neon.tech)** ou **Supabase** e copia a
   **Connection string** (ver secção 1.A).
2. Põe o código num repositório Git (GitHub) — já tens `Davide5fonseca/teste3`.
3. No [Render](https://render.com): **New → Blueprint** → escolhe o repositório.
   Ele lê o `render.yaml` automaticamente.
4. Define os **segredos** no painel (ficaram como `sync: false`):
   - `DATABASE_URL` = a connection string do Neon/Supabase
   - `ANTHROPIC_API_KEY` = opcional (sem ela, os talões usam o OCR do telemóvel)
5. Deploy → ficas com `https://despesas.onrender.com` (HTTPS automático ✅).
   Abre `…/api/saude` para confirmar.

O que o blueprint faz, equivalente a configurar à mão um *Web Service*:
- **Root Directory:** `.` (raiz)
- **Build Command:** `npm --prefix client install && npm --prefix client run build && npm --prefix server install`
- **Start Command:** `npm --prefix server start`
- **Health Check Path:** `/api/saude`

> 💡 O plano **gratuito** do Render adormece ao fim de ~15 min de inatividade
> (o 1.º pedido a seguir demora uns segundos a acordar). Os **dados não se perdem**
> porque vivem no Postgres. Para evitar o "adormecer", usa um plano pago.

### 3.2 (Alternativa) Versão 100% offline, **sem backend**

Se quiseres dispensar servidor e guardar tudo **no próprio telemóvel**:

- Substitui as chamadas em `client/src/api/client.ts` por leitura/escrita em
  **IndexedDB** (ex.: lib `idb`) ou `localStorage`, mantendo os mesmos tipos
  (`Despesa`, `Categoria`, `Membro`) e a lógica de resumo passa para o cliente.
- A app instala na mesma como PWA e abre offline.
- **Limitação:** a leitura de talões por IA **deixa de poder usar a chave em
  segurança** (uma chave Anthropic nunca deve ir para o frontend). Opções:
  manter um pequeno endpoint só para `/api/talao/ler` (função *serverless* na
  Vercel/Netlify com a chave como *secret*), ou abdicar da leitura por IA na
  versão totalmente offline.

---

## 4) 📲 Instalar no telemóvel (“Adicionar ao ecrã principal”)

Com a app aberta em **HTTPS** (secção 3) ou via túnel (secção 2):

**Android (Chrome):**
1. Abre o site no Chrome.
2. Menu **⋮** → **“Instalar aplicação”** / **“Adicionar ao ecrã principal”**.
3. Confirma. Fica um ícone no ecrã; abre **em ecrã inteiro**, sem barra do browser.

**iPhone/iPad (Safari — exige HTTPS):**
1. Abre o site no **Safari**.
2. Botão **Partilhar** (quadrado com seta) → **“Adicionar ao ecrã principal”**.
3. Confirma. Abre como app, em ecrã inteiro.

O *service worker* faz cache do *shell* da app, por isso abre **offline**. A
leitura de talões por IA precisa de internet; o resto (ver, adicionar manual,
gráficos do que já carregaste) funciona offline.

---

## 🔌 API REST (referência rápida)

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/api/despesas?mes=YYYY-MM&categoria=ID` | lista filtrada |
| `POST` | `/api/despesas` | cria |
| `PUT` | `/api/despesas/:id` | edita |
| `DELETE` | `/api/despesas/:id` | apaga |
| `GET` | `/api/resumo?mes=YYYY-MM` | `{ total, porCategoria[], porPessoa[], evolucao[] }` |
| `GET` | `/api/saldos?mes=YYYY-MM` | acertar contas: `{ saldos[], transferencias[] }` (mes opcional) |
| `GET/POST/PUT/DELETE` | `/api/categorias` | gerir categorias (PUT = renomear/cor) |
| `GET/POST/PUT/DELETE` | `/api/membros` | gerir membros (PUT = renomear) |
| `POST` | `/api/talao/ler` | (multipart, campo `imagem`) extrai dados do talão — **não grava** |
| `GET` | `/api/saude` | estado da API + se a IA está configurada |
| `POST` | `/api/familias` | cria família + categorias iniciais → devolve `{ id, codigo, nome }` |
| `POST` | `/api/familias/entrar` | valida um `codigo` e devolve a família |
| `GET` | `/api/familias/atual` | dados da família atual (via cabeçalho) |

> **Famílias (várias casas):** cada casa tem um **código** (ex.: `MY4TRP`). Quem
> cria a família recebe o código; os outros **entram com esse código** e passam a
> ver/registar as mesmas despesas. Cada pedido às rotas de dados leva o cabeçalho
> `x-familia-codigo`, e o servidor isola tudo por família. Trocas/sais de família
> em **Definições**. O código é guardado no dispositivo (`localStorage`).
>
> **Tema claro/escuro:** botão em *Definições* (e no ecrã inicial). Segue a
> preferência do sistema por omissão e fica guardado no dispositivo.

**Resposta de `/api/talao/ler`:**
```json
{ "valor": 12.50, "loja": "Continente", "data": "2026-06-03",
  "categoria_sugerida": "Supermercado", "confianca": "alta" }
```
Campos ilegíveis vêm a `null` e `confianca: "baixa"`. A IA **nunca grava** — os
dados pré-preenchem o formulário e o utilizador confirma.

---

## 🔒 Notas de segurança

- A `ANTHROPIC_API_KEY` vive **apenas no servidor** (`.env` / variável secreta do
  host). Nunca no frontend. O `.env` está no `.gitignore`.
- A imagem do talão é processada em memória (não é gravada em disco).
- Em produção, considera restringir o CORS à origem da tua app.

---

## 🛠️ Resolução de problemas

- **“Leitura por IA indisponível: falta a ANTHROPIC_API_KEY”** → define a chave no
  `.env` do servidor (local) ou nas variáveis de ambiente do host (produção) e
  reinicia o backend.
- **A câmara não abre no telemóvel** → precisas de HTTPS (secção 3) ou de um túnel
  HTTPS (secção 2). Em `http://` simples a câmara é bloqueada.
- **“DATABASE_URL em falta” ou erro a ligar à BD** → confirma que puseste a
  connection string do Postgres no `server/.env` (ou nas env vars do host). Hosts
  remotos (Neon/Supabase) exigem SSL — o código já o ativa automaticamente.
- **O telemóvel não abre `http://192.168.x.x:5173`** → confirma que estão na mesma
  Wi-Fi e que a firewall do PC permite a porta 5173 (em Windows, autoriza o Node
  na primeira vez que pedir).
