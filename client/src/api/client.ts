// Cliente fetch tipado para a API REST.
// Base configurável: por omissão usa "/api" (proxy do Vite em dev / mesma origem
// em produção). Para um backend remoto define VITE_API_URL.
const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "/api";

// ──────────────────────── Família (multi-casa) ───────────────────
export interface Familia {
  id: number;
  codigo: string;
  nome: string;
}

const FAMILIA_KEY = "despesas_familia";

export function getFamilia(): Familia | null {
  try {
    const raw = localStorage.getItem(FAMILIA_KEY);
    return raw ? (JSON.parse(raw) as Familia) : null;
  } catch {
    return null;
  }
}

export function setFamilia(f: Familia | null) {
  if (f) localStorage.setItem(FAMILIA_KEY, JSON.stringify(f));
  else localStorage.removeItem(FAMILIA_KEY);
}

function cabecalhoFamilia(): Record<string, string> {
  const f = getFamilia();
  return f ? { "x-familia-codigo": f.codigo } : {};
}

// ───────────────────────────── Tipos ─────────────────────────────
export interface Membro {
  id: number;
  nome: string;
}

export interface Categoria {
  id: number;
  nome: string;
  cor: string;
}

export type Origem = "manual" | "talao" | "fixa";

export interface Despesa {
  id: number;
  valor_centimos: number;
  descricao: string;
  data: string; // YYYY-MM-DD
  origem: Origem;
  criado_em: string;
  categoria_id: number | null;
  categoria_nome: string | null;
  categoria_cor: string | null;
  membro_id: number | null;
  membro_nome: string | null;
  participantes: number[]; // membros que dividem o custo
}

export interface DespesaInput {
  valor_centimos: number;
  descricao: string;
  categoria_id: number | null;
  membro_id: number | null;
  data: string;
  origem: Origem;
  participantes: number[];
}

export interface DespesaFixa {
  id: number;
  valor_centimos: number;
  descricao: string;
  dia: number; // dia do mês (1-31)
  ativa: boolean;
  participantes: number[];
  categoria_id: number | null;
  categoria_nome: string | null;
  categoria_cor: string | null;
  membro_id: number | null;
  membro_nome: string | null;
}

export interface DespesaFixaInput {
  valor_centimos: number;
  descricao: string;
  categoria_id: number | null;
  membro_id: number | null;
  dia: number;
  participantes: number[];
  ativa: boolean;
}

export interface Saldos {
  mes: string | null;
  despesasContadas: number;
  saldos: Array<{
    membro_id: number;
    nome: string;
    pagou: number;
    deve: number;
    saldo: number; // >0 tem a receber; <0 deve
  }>;
  transferencias: Array<{
    de_id: number;
    de_nome: string;
    para_id: number;
    para_nome: string;
    valor: number;
  }>;
}

export interface Resumo {
  mes: string;
  total: number;
  porCategoria: Array<{
    categoria_id: number | null;
    nome: string;
    cor: string;
    total: number;
  }>;
  porPessoa: Array<{ membro_id: number | null; nome: string; total: number }>;
  evolucao: Array<{ mes: string; total: number }>;
}

export interface TalaoExtraido {
  valor: number | null; // euros
  loja: string | null;
  data: string | null; // YYYY-MM-DD
  categoria_sugerida: string;
  confianca: "alta" | "media" | "baixa";
  nif?: string | null; // NIF do emitente (vem do QR fiscal, quando existe)
}

// ───────────────────────────── Núcleo ─────────────────────────────
async function pedir<T>(caminho: string, opcoes?: RequestInit): Promise<T> {
  const resposta = await fetch(`${BASE}${caminho}`, {
    ...opcoes,
    headers: {
      "Content-Type": "application/json",
      ...cabecalhoFamilia(),
      ...(opcoes?.headers || {}),
    },
  });
  if (!resposta.ok) {
    // Código de família inválido/expirado -> volta ao ecrã de família.
    if (resposta.status === 401 && getFamilia()) {
      setFamilia(null);
      location.reload();
    }
    throw await erroDe(resposta);
  }
  if (resposta.status === 204) return undefined as T;
  return resposta.json() as Promise<T>;
}

async function erroDe(resposta: Response): Promise<Error> {
  let detalhe = "";
  try {
    const corpo = await resposta.json();
    detalhe = corpo?.erro
      ? typeof corpo.erro === "string"
        ? corpo.erro
        : JSON.stringify(corpo.erro)
      : "";
  } catch {
    /* sem corpo JSON */
  }
  return new Error(detalhe || `Erro ${resposta.status}`);
}

// ───────────────────────────── API ─────────────────────────────
export const api = {
  // Estado do servidor (ia=true se a leitura por IA estiver configurada)
  saude() {
    return pedir<{ ok: boolean; ia: boolean }>("/saude");
  },

  // Família
  criarFamilia(nome: string, pin?: string) {
    return pedir<Familia>("/familias", {
      method: "POST",
      body: JSON.stringify({ nome, pin: pin || undefined }),
    });
  },
  // Devolve a família; em erro lança Error com .pinNecessario quando aplicável.
  async entrarFamilia(codigo: string, pin?: string): Promise<Familia> {
    const resposta = await fetch(`${BASE}/familias/entrar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codigo: codigo.trim().toUpperCase(), pin: pin || undefined }),
    });
    if (!resposta.ok) {
      let corpo: any = {};
      try {
        corpo = await resposta.json();
      } catch {
        /* sem corpo */
      }
      const err = new Error(
        typeof corpo?.erro === "string" ? corpo.erro : `Erro ${resposta.status}`
      ) as Error & { pinNecessario?: boolean };
      err.pinNecessario = !!corpo?.pinNecessario;
      throw err;
    }
    return resposta.json() as Promise<Familia>;
  },

  // Despesas
  listarDespesas(filtros: { mes?: string; categoria?: number | null } = {}) {
    const q = new URLSearchParams();
    if (filtros.mes) q.set("mes", filtros.mes);
    if (filtros.categoria) q.set("categoria", String(filtros.categoria));
    const qs = q.toString();
    return pedir<Despesa[]>(`/despesas${qs ? `?${qs}` : ""}`);
  },
  criarDespesa(d: DespesaInput) {
    return pedir<Despesa>("/despesas", { method: "POST", body: JSON.stringify(d) });
  },
  editarDespesa(id: number, d: DespesaInput) {
    return pedir<Despesa>(`/despesas/${id}`, { method: "PUT", body: JSON.stringify(d) });
  },
  apagarDespesa(id: number) {
    return pedir<void>(`/despesas/${id}`, { method: "DELETE" });
  },

  // Resumo
  resumo(mes: string) {
    return pedir<Resumo>(`/resumo?mes=${mes}`);
  },

  // Saldos / acertar contas (mes opcional)
  saldos(mes?: string) {
    return pedir<Saldos>(`/saldos${mes ? `?mes=${mes}` : ""}`);
  },

  // Despesas fixas / subscrições
  listarFixas() {
    return pedir<DespesaFixa[]>("/fixas");
  },
  criarFixa(d: DespesaFixaInput) {
    return pedir<DespesaFixa>("/fixas", { method: "POST", body: JSON.stringify(d) });
  },
  editarFixa(id: number, d: DespesaFixaInput) {
    return pedir<DespesaFixa>(`/fixas/${id}`, { method: "PUT", body: JSON.stringify(d) });
  },
  apagarFixa(id: number) {
    return pedir<void>(`/fixas/${id}`, { method: "DELETE" });
  },

  // Categorias
  listarCategorias() {
    return pedir<Categoria[]>("/categorias");
  },
  criarCategoria(nome: string, cor: string) {
    return pedir<Categoria>("/categorias", { method: "POST", body: JSON.stringify({ nome, cor }) });
  },
  editarCategoria(id: number, nome: string, cor: string) {
    return pedir<Categoria>(`/categorias/${id}`, {
      method: "PUT",
      body: JSON.stringify({ nome, cor }),
    });
  },
  apagarCategoria(id: number) {
    return pedir<void>(`/categorias/${id}`, { method: "DELETE" });
  },

  // Membros
  listarMembros() {
    return pedir<Membro[]>("/membros");
  },
  criarMembro(nome: string) {
    return pedir<Membro>("/membros", { method: "POST", body: JSON.stringify({ nome }) });
  },
  editarMembro(id: number, nome: string) {
    return pedir<Membro>(`/membros/${id}`, { method: "PUT", body: JSON.stringify({ nome }) });
  },
  apagarMembro(id: number) {
    return pedir<void>(`/membros/${id}`, { method: "DELETE" });
  },

  // Leitura de talão por IA (multipart). NÃO grava — devolve dados extraídos.
  async lerTalao(imagem: Blob): Promise<TalaoExtraido> {
    const fd = new FormData();
    fd.append("imagem", imagem, "talao.jpg");
    const resposta = await fetch(`${BASE}/talao/ler`, {
      method: "POST",
      headers: { ...cabecalhoFamilia() },
      body: fd,
    });
    if (!resposta.ok) throw await erroDe(resposta);
    return resposta.json() as Promise<TalaoExtraido>;
  },
};
