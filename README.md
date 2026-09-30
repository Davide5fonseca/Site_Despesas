# ScanWise

App web **PWA** (instala-se no telemóvel, sem app store) para **organizar as despesas e
a poupança** — sozinho ou em grupo (casa, casal, amigos). Fotografas o talão, a app lê o
**QR fiscal** (valor, data, IVA exatos) e a IA/OCR preenche a loja e a categoria; tu
confirmas e gravas. Também há entrada manual, despesas fixas, orçamentos e "acertar contas".

```
┌──────────────┐      ┌────────────────────┐      ┌──────────────────────────┐
│  React + PWA │ ───▶ │ Express (API REST) │ ───▶ │ Postgres (Neon/Supabase) │
│  (telemóvel) │      │  /api/talao/ler ───────────▶ Anthropic (visão)        │
└──────────────┘      └────────────────────┘      └──────────────────────────┘
```

- **Frontend:** React 18 + Vite + TypeScript, Tailwind, Recharts, React Router, `vite-plugin-pwa`,
  `jsqr` (QR fiscal), `tesseract.js` (OCR no telemóvel), `jspdf` (relatório).
- **Backend:** Node 22 + Express, Postgres via `pg`, Zod, `@anthropic-ai/sdk`, `multer`, rate-limit.
- **Dinheiro em cêntimos (inteiros)** — sem erros de vírgula flutuante.
- **IA:** `claude-sonnet-5-5` com *structured outputs* (JSON garantido). Opcional: sem chave, o
  OCR corre no telemóvel. Configurável em `ANTHROPIC_MODEL`.

## Funcionalidades

| | |
|---|---|
| 📷 **Scan de talão** | QR fiscal da AT (valor, data, NIF, ATCUD, IVA) + IA ou OCR local para loja/categoria. Se o QR chega e a loja é reconhecida pelo NIF, nem chama a IA. Aviso de talão repetido. |
| ✍️ **Entrada manual** | Valor, descrição, categoria, quem pagou, dividir por quem. |
| 🔁 **Despesas fixas** | Rendas, subscrições… entram sozinhas todos os meses (inclui meses em que não abriste a app). |
| 💰 **Poupança e orçamentos** | Define o rendimento mensal e limites por categoria/total; o Resumo mostra o que sobra, o ritmo diário e avisa aos 80%/100%. |
| 📊 **Resumo** | Donut por categoria com variação face ao mês anterior, total por pessoa, últimos 6 meses. |
| 🤝 **Acertar contas** | Quem deve a quem, com o mínimo de transferências. |
| 📶 **Offline** | Registas sem rede; sincroniza sozinho depois, sem duplicar. |
| 📄 **Exportar** | PDF do mês (com IVA) e CSV. |
| 👥 **Grupos** | Código de 8 caracteres para convidar; PIN opcional (com PIN, só o código não chega para ver os dados). |
| 🌗 **Tema** | Claro/escuro. |

## Estrutura

```
ScanWise/
├── render.yaml             # deploy num só serviço no Render
├── server/                 # API + base de dados + IA
│   ├── index.ts            # Express, rotas, autenticação por grupo, limites
│   ├── db.ts               # pool Postgres, sessões, helpers; aplica schema.sql
│   ├── schema.sql          # FONTE ÚNICA do esquema (idempotente)
│   ├── lib/anthropic.ts    # leitura do talão por IA (structured outputs)
│   ├── lib/fixas.ts        # geração mensal das despesas fixas
│   ├── lib/tempo.ts        # datas no fuso Europe/Lisbon
│   ├── routes/             # despesas, categorias, membros, resumo, saldos, fixas, orcamentos, talao, familias
│   └── tests/api.test.ts   # testes de integração (Postgres em Docker)
└── client/                 # PWA React
    ├── src/api/client.ts   # fetch tipado (cabeçalhos de grupo + token)
    ├── src/lib/            # qrTalao, ocrTalao, lojas, sync offline, exportarPDF, format…
    ├── src/pages/          # Inicio, Resumo, PorPessoa, Definicoes
    ├── src/components/     # ScanTalao, FormDespesa, Orcamentos, BarrasOrcamento, EscolherMembro…
    └── tests/              # testes da lógica pura (QR, OCR, lojas, formatação)
```

## 1) Correr localmente

Precisas de **Node 20–24** e (para os testes) **Docker**. Dois terminais.

**Backend**

```bash
cd server
npm install
copy .env.example .env      # macOS/Linux: cp .env.example .env
```

Edita `server/.env`:

```
DATABASE_URL=postgres://utilizador:senha@host:5432/base?sslmode=require   # obrigatório
ANTHROPIC_API_KEY=                                                          # opcional
```

Base de dados grátis: **[Neon](https://neon.tech)** (recomendado) ou **[Supabase](https://supabase.com)** —
copia a *connection string*. As tabelas são criadas automaticamente no 1.º arranque
(`schema.sql`). Para desenvolvimento sem nuvem:

```bash
docker run -d -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=despesas -p 5433:5432 postgres:16
# DATABASE_URL=postgres://postgres:postgres@localhost:5433/despesas
```

```bash
npm run dev          # http://localhost:3001
```

**Frontend**

```bash
cd client
npm install
npm run dev          # http://localhost:5173  (proxy /api -> 3001)
```

> A porta 5173 pode estar ocupada por outro projeto; `npm run dev -- --port 5174` resolve.

## 2) No telemóvel (mesma Wi-Fi)

Abre `http://IP-DO-PC:5173` (descobre o IP com `ipconfig` / `ipconfig getifaddr en0` / `hostname -I`).

> ⚠️ A **câmara** só funciona em **HTTPS** (ou `localhost`). Para testar a foto a sério usa um túnel:
> `npx localtunnel --port 5173` ou `npx cloudflared tunnel --url http://localhost:5173`.

## 3) Online em HTTPS, de graça (Render)

Um único serviço: o Express serve a API **e** o frontend compilado. Os dados vivem num
Postgres externo, por isso persistem mesmo no plano gratuito.

1. Cria a base de dados (Neon/Supabase) e copia a *connection string*.
2. Repositório no GitHub → [Render](https://render.com) → **New → Blueprint** → escolhe o repo
   (lê o [`render.yaml`](render.yaml)).
3. Define os segredos no painel: `DATABASE_URL` e, opcional, `ANTHROPIC_API_KEY`.
4. Deploy → `https://….onrender.com`. Confirma em `/api/saude`.

Variáveis úteis: `ANTHROPIC_MODEL` (default `claude-sonnet-5-5`), `TALAO_LIMITE_DIA` (leituras por IA
por grupo/dia, default 100), `APP_TZ` (default `Europe/Lisbon`), `FRONTEND_ORIGIN` (restringir CORS).

> O plano gratuito adormece após ~15 min sem uso; o 1.º pedido demora uns segundos. Os dados não se perdem.

## 4) Instalar como app

- **Android (Chrome):** menu ⋮ → *Instalar aplicação*.
- **iPhone (Safario, exige HTTPS):** Partilhar → *Adicionar ao ecrã principal*.

Abre offline (o *shell* fica em cache); registar despesas offline também funciona — sincroniza
quando houver rede. A leitura por IA precisa de internet; o OCR local só precisa na 1.ª vez.

## Testes

```bash
cd server && npm run db:test && npm test     # 17 testes de integração (Docker, porta 5433)
cd client && npm test                        # lógica pura: QR fiscal, OCR, lojas, formatação
npm run typecheck                            # em qualquer das pastas
```

## API REST

Todas as rotas de dados levam `x-familia-codigo`; grupos com PIN levam também `x-familia-token`
(devolvido por `POST /api/familias/entrar`).

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/saude` | estado + se a IA está configurada |
| `POST` | `/api/familias` | cria grupo `{nome, pin?}` → `{id, codigo, nome, temPin, token?}` |
| `POST` | `/api/familias/entrar` | `{codigo, pin?}` → grupo (+ `token` se tiver PIN) |
| `GET/PATCH` | `/api/familias/atual` | ver / renomear / definir `rendimento_centimos` |
| `DELETE` | `/api/familias` | apaga o grupo (só grupos de 1 membro; exige PIN se houver) |
| `GET/POST/PUT/DELETE` | `/api/despesas` | `?mes=YYYY-MM&categoria=ID`; `cliente_id` torna o POST idempotente |
| `GET` | `/api/despesas/por-talao?talaoId=` | despesas com a mesma chave de talão (duplicados) |
| `GET/POST/PUT/DELETE` | `/api/fixas` | despesas fixas / subscrições |
| `GET/PUT` | `/api/orcamentos` | `{categoria_id | null, valor_centimos | null}` |
| `GET` | `/api/resumo?mes=` | total, mês anterior, poupança, por categoria (com `anterior`), por pessoa, evolução, orçamentos |
| `GET` | `/api/saldos?mes=` | acertar contas (sem `mes` = tudo) |
| `GET/POST/PUT/DELETE` | `/api/categorias`, `/api/membros` | gestão |
| `POST` | `/api/talao/ler` | multipart `imagem` → `{valor, loja, data, categoria_sugerida, confianca}`; **não grava** |

## Segurança

- A chave da IA vive só no servidor. A imagem do talão é processada em memória.
- Cada pedido é isolado pelo grupo; categorias/membros de outro grupo são rejeitados.
- PIN guardado com bcrypt; sessões guardadas por hash. Limites de pedidos por IP e, na IA, por grupo.
- Apagar um grupo só é possível em grupos individuais.

## Resolução de problemas

- **"Leitura por IA indisponível"** → falta `ANTHROPIC_API_KEY`; a app usa o OCR do telemóvel.
- **"Sessão inválida. Volta a entrar com o PIN."** → o dispositivo perdeu a sessão; entra de novo com código + PIN.
- **Câmara não abre** → precisa de HTTPS (secção 2/3).
- **Erro a ligar à BD** → confirma `DATABASE_URL`; hosts remotos exigem SSL (já ativado automaticamente).
- **Despesa "recusada pelo servidor" na barra amarela** → foi criada offline e o servidor não a aceitou (ex.: categoria apagada); descarta-a ou regista de novo.
