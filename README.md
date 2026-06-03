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
│  React + PWA │ ───▶ │ Express (API REST) │ ───▶ │ SQLite (better-sqlite3) │
│  (telemóvel) │      │  /api/talao/ler ───────────▶ Anthropic (visão)     │
└──────────────┘      └────────────────────┘      └──────────────────────┘
```

- **Frontend:** React 18 + Vite + TypeScript, Tailwind CSS, Recharts (donut + barras),
  React Router (Resumo / Movimentos / Definições), `vite-plugin-pwa`.
- **Backend:** Node.js + Express, SQLite via `better-sqlite3`, validação com Zod,
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
│   ├── db.ts               # SQLite + migrações + seed de categorias
│   ├── lib/anthropic.ts    # cliente Anthropic + extração estruturada do talão
│   ├── routes/             # despesas, categorias, membros, resumo, talao
│   ├── .env.example        # → copia para .env e põe a chave
│   └── despesas.db         # criada em runtime (ignorada no git)
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

Edita `server/.env` e mete a tua chave:

```
ANTHROPIC_API_KEY=sk-ant-...
```

**Como obter a chave:** entra em <https://console.anthropic.com/> →
*Settings* → *API Keys* → *Create Key*. (Precisas de créditos/cartão na conta.)
A chave vive **só no servidor** — nunca é exposta ao frontend.

> Sem chave a app funciona à mesma; só a **leitura de talões por IA** fica
> indisponível (a entrada manual continua a funcionar).

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
isso é só **1 URL**, sem CORS e sem `VITE_API_URL`. O ficheiro
[`render.yaml`](render.yaml) na raiz já configura tudo (build do cliente +
arranque do servidor, *health check*, disco e variáveis).

1. Põe o código num repositório Git (GitHub) — já tens `Davide5fonseca/teste3`.
2. No [Render](https://render.com): **New → Blueprint** → escolhe o repositório.
   Ele lê o `render.yaml` automaticamente.
3. Define o **segredo** `ANTHROPIC_API_KEY` no painel (ficou como `sync: false`).
4. Deploy → ficas com `https://despesas.onrender.com` (HTTPS automático ✅).
   Abre `…/api/saude` para confirmar.

O que o blueprint faz, equivalente a configurar à mão um *Web Service*:
- **Root Directory:** `.` (raiz)
- **Build Command:** `npm --prefix client install && npm --prefix client run build && npm --prefix server install`
- **Start Command:** `npm --prefix server start`
- **Health Check Path:** `/api/saude`

> ⚠️ **Persistência dos dados:** o SQLite grava num ficheiro. O **disco persistente
> do Render só existe em planos PAGOS** (Starter ≈ 7 $/mês). No **plano gratuito**
> remove o bloco `disk` e a env `DB_PATH` do `render.yaml` — mas os dados são
> **apagados a cada reinício/redeploy** (só serve para testar). Para persistência
> gratuita, vê 3.2 (Fly.io).

### 3.2 (Alternativa grátis com persistência) **Fly.io** com volume

O Fly.io tem volumes no tier gratuito. Na raiz do projeto:

```bash
fly launch            # cria a app (não faças deploy ainda)
fly volumes create dados --size 1
```

No `fly.toml`, monta o volume e define o serviço para correr o backend (que já
serve o frontend). Define os *secrets*:

```bash
fly secrets set ANTHROPIC_API_KEY=sk-ant-... DB_PATH=/data/despesas.db
fly deploy
```

(O build deve compilar o cliente e arrancar o servidor, tal como o `render.yaml`.)

### 3.3 (Alternativa) Versão 100% offline, **sem backend**

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
- **`better-sqlite3` falha a instalar** → usa Node 18–24; este projeto usa a v12
  do `better-sqlite3`, que traz binários pré-compilados (não precisa de Python).
- **O telemóvel não abre `http://192.168.x.x:5173`** → confirma que estão na mesma
  Wi-Fi e que a firewall do PC permite a porta 5173 (em Windows, autoriza o Node
  na primeira vez que pedir).
