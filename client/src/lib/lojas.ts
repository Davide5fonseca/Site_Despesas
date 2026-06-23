import type { TalaoExtraido } from "../api/client";

// Lojas/marcas portuguesas conhecidas. Reconhecidas por NIF (do QR fiscal —
// fiável) e/ou por NOME (do talão). Cada loja traz nome canónico, cor da marca
// (avatar), domínio (logótipo real) e CATEGORIA default — a despesa entra já
// pré-categorizada (editável).
//
// Mapa único e extensível: para ativar a auto-categoria por NIF, basta
// preencher `nifs` numa loja (ver "COMO ADICIONAR NIFs" no fim do ficheiro).
//
// Nota: a categoria tem de existir nas categorias semeadas
// (Supermercado, Restauração, Saúde, Transportes, Contas/Serviços, Lazer, Renda, Outros).
export interface Loja {
  nome: string; // nome canónico para mostrar
  cor: string; // cor da marca (fundo/realce do avatar e fallback)
  categoria: string; // categoria sugerida (nome canónico)
  emoji: string; // ícone de fallback (quando não há logo/internet)
  padrao: RegExp; // como reconhecer no nome do talão
  dominio?: string; // domínio da marca, para ir buscar o logótipo real em runtime
  nifs?: string[]; // NIF(s) do emitente no QR fiscal — auto-categoria por NIF
}

const LOJAS: Loja[] = [
  // ── Supermercados ──
  { nome: "Continente", cor: "#e2001a", categoria: "Supermercado", emoji: "🛒", dominio: "continente.pt", nifs: ["502011475", "501591109"], padrao: /continente|\bmodelo\b/i },
  { nome: "Pingo Doce", cor: "#009640", categoria: "Supermercado", emoji: "🛒", dominio: "pingodoce.pt", nifs: ["500829993"], padrao: /pingo\s*doce/i },
  { nome: "Lidl", cor: "#0050aa", categoria: "Supermercado", emoji: "🛒", dominio: "lidl.pt", nifs: ["503340855"], padrao: /\blidl\b/i },
  { nome: "Aldi", cor: "#001e96", categoria: "Supermercado", emoji: "🛒", dominio: "aldi.pt", padrao: /\baldi\b/i },
  { nome: "Minipreço", cor: "#e30613", categoria: "Supermercado", emoji: "🛒", dominio: "minipreco.pt", padrao: /minipre[çc]o/i },
  { nome: "Auchan", cor: "#e2001a", categoria: "Supermercado", emoji: "🛒", dominio: "auchan.pt", padrao: /auchan|jumbo/i },
  { nome: "Intermarché", cor: "#e2001a", categoria: "Supermercado", emoji: "🛒", dominio: "intermarche.pt", padrao: /intermarch/i },
  { nome: "Mercadona", cor: "#00803d", categoria: "Supermercado", emoji: "🛒", dominio: "mercadona.pt", padrao: /mercadona/i },
  { nome: "El Corte Inglés", cor: "#0a5c2b", categoria: "Supermercado", emoji: "🛍️", dominio: "elcorteingles.pt", padrao: /corte\s*ingl/i },

  // ── Combustível / Transportes ──
  { nome: "Galp", cor: "#ff5f00", categoria: "Transportes", emoji: "⛽", dominio: "galp.com", padrao: /\bgalp\b/i },
  { nome: "BP", cor: "#00914c", categoria: "Transportes", emoji: "⛽", dominio: "bp.com", padrao: /\bbp\b/i },
  { nome: "Repsol", cor: "#ff8200", categoria: "Transportes", emoji: "⛽", dominio: "repsol.pt", padrao: /repsol/i },
  { nome: "Cepsa", cor: "#0a3d91", categoria: "Transportes", emoji: "⛽", dominio: "cepsa.pt", padrao: /cepsa/i },
  { nome: "Prio", cor: "#e30613", categoria: "Transportes", emoji: "⛽", dominio: "prioenergy.com", padrao: /\bprio\b/i },
  { nome: "Via Verde", cor: "#009a44", categoria: "Transportes", emoji: "🛣️", dominio: "viaverde.pt", padrao: /via\s*verde|portagem|brisa/i },
  { nome: "CP Comboios", cor: "#5a2d81", categoria: "Transportes", emoji: "🚆", dominio: "cp.pt", padrao: /\bcp\b|comboios|metro\b/i },
  { nome: "Uber", cor: "#000000", categoria: "Transportes", emoji: "🚗", dominio: "uber.com", padrao: /\buber\b/i },
  { nome: "Bolt", cor: "#34d186", categoria: "Transportes", emoji: "🚗", dominio: "bolt.eu", padrao: /\bbolt\b/i },

  // ── Restauração ──
  { nome: "McDonald's", cor: "#da291c", categoria: "Restauração", emoji: "🍔", dominio: "mcdonalds.pt", padrao: /mcdonald|\bmc\s*donald/i },
  { nome: "Burger King", cor: "#d62300", categoria: "Restauração", emoji: "🍔", dominio: "burgerking.pt", padrao: /burger\s*king/i },
  { nome: "KFC", cor: "#a3080c", categoria: "Restauração", emoji: "🍗", dominio: "kfc.pt", padrao: /\bkfc\b/i },
  { nome: "Telepizza", cor: "#e2001a", categoria: "Restauração", emoji: "🍕", dominio: "telepizza.pt", padrao: /telepizza|pizza\s*hut|dominos|domino's/i },
  { nome: "Starbucks", cor: "#00704a", categoria: "Restauração", emoji: "☕", dominio: "starbucks.pt", padrao: /starbucks/i },
  { nome: "Vitaminas", cor: "#7ac143", categoria: "Restauração", emoji: "🥗", padrao: /vitaminas|\bh3\b|\bnood\b/i },

  // ── Tecnologia / Lazer / Compras ──
  { nome: "Worten", cor: "#e2001a", categoria: "Lazer", emoji: "📺", dominio: "worten.pt", padrao: /worten/i },
  { nome: "Fnac", cor: "#b8860b", categoria: "Lazer", emoji: "📚", dominio: "fnac.pt", padrao: /\bfnac\b/i },
  { nome: "MediaMarkt", cor: "#df0000", categoria: "Lazer", emoji: "📺", dominio: "mediamarkt.pt", padrao: /media\s*markt/i },
  { nome: "IKEA", cor: "#0058a3", categoria: "Outros", emoji: "🛋️", dominio: "ikea.pt", padrao: /\bikea\b/i },
  { nome: "Primark", cor: "#0093d0", categoria: "Outros", emoji: "👕", dominio: "primark.com", padrao: /primark/i },
  { nome: "Zara", cor: "#000000", categoria: "Outros", emoji: "👕", dominio: "zara.com", padrao: /\bzara\b/i },
  { nome: "Netflix", cor: "#e50914", categoria: "Lazer", emoji: "🎬", dominio: "netflix.com", padrao: /netflix/i },
  { nome: "Spotify", cor: "#1db954", categoria: "Lazer", emoji: "🎵", dominio: "spotify.com", padrao: /spotify/i },

  // ── Saúde ──
  { nome: "Farmácia", cor: "#009640", categoria: "Saúde", emoji: "💊", padrao: /farm[áa]cia|parafarm/i },
  { nome: "Wells", cor: "#0aa0a0", categoria: "Saúde", emoji: "💊", dominio: "wells.pt", padrao: /\bwells\b/i },

  // ── Contas / Serviços ──
  { nome: "EDP", cor: "#15a04a", categoria: "Contas/Serviços", emoji: "⚡", dominio: "edp.pt", padrao: /\bedp\b/i },
  { nome: "Galp Energia", cor: "#ff5f00", categoria: "Contas/Serviços", emoji: "⚡", dominio: "galp.com", padrao: /galp\s*energia/i },
  { nome: "MEO", cor: "#00a0e1", categoria: "Contas/Serviços", emoji: "📶", dominio: "meo.pt", padrao: /\bmeo\b/i },
  { nome: "NOS", cor: "#83be23", categoria: "Contas/Serviços", emoji: "📶", dominio: "nos.pt", padrao: /\bnos\b/i },
  { nome: "Vodafone", cor: "#e60000", categoria: "Contas/Serviços", emoji: "📶", dominio: "vodafone.pt", padrao: /vodafone/i },
  { nome: "NOWO", cor: "#ff6a13", categoria: "Contas/Serviços", emoji: "📶", dominio: "nowo.pt", padrao: /\bnowo\b/i },
  { nome: "Águas", cor: "#00a3e0", categoria: "Contas/Serviços", emoji: "💧", padrao: /\bepal\b|\bsmas\b|[áa]guas\s+d[eo]\b/i },
];

// Reconhece a loja pelo NIF do emitente (campo A do QR fiscal). Fiável.
export function reconhecerLojaPorNif(nif?: string | null): Loja | null {
  if (!nif) return null;
  const n = nif.trim();
  for (const l of LOJAS) if (l.nifs?.includes(n)) return l;
  return null;
}

// Reconhece a loja a partir de um texto (nome do talão / descrição). null se nenhuma.
export function reconhecerLoja(texto?: string | null): Loja | null {
  if (!texto) return null;
  for (const l of LOJAS) if (l.padrao.test(texto)) return l;
  return null;
}

// Se reconhecermos a loja, melhora o nome (canónico) e a categoria sugerida.
// Prioridade: NIF (do QR, exato) > nome (do OCR, difuso).
export function enriquecerLoja(dados: TalaoExtraido): TalaoExtraido {
  const l = reconhecerLojaPorNif(dados.nif) ?? reconhecerLoja(dados.loja);
  if (!l) return dados;
  return { ...dados, loja: l.nome, categoria_sugerida: l.categoria };
}

// ─────────────────────────────────────────────────────────────────────────
// COMO ADICIONAR NIFs (auto-categoria por NIF):
//   Acrescenta `nifs: ["500000000"]` à loja correspondente acima.
//   Ex.:  { nome: "Continente", ..., nifs: ["NIF_REAL_AQUI"] }
//   O NIF é o campo A do QR fiscal (9 dígitos). Confirma o NIF real no talão
//   antes de adicionar — um NIF errado atribui a loja/categoria errada.
// Enquanto `nifs` estiver vazio, a categoria continua a vir do reconhecimento
// por NOME (que já funciona); o NIF é a camada mais fiável quando preenchida.
// ─────────────────────────────────────────────────────────────────────────
