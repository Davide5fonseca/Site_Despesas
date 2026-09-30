import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod/v4"; // o helper zodOutputFormat do SDK exige Zod v4

// Modelo com visão. Sonnet 5.5 é o Sonnet atual: rápido, com visão e o mais
// barato da família Sonnet ($2/$10 por MTok). Configurável por ambiente.
const MODELO = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";

// A chave vive SÓ no servidor (.env). Nunca exposta ao frontend.
let cliente: Anthropic | null = null;
function obterCliente(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw Object.assign(new Error("ANTHROPIC_API_KEY em falta no servidor (.env)"), {
      codigo: "SEM_CHAVE",
    });
  }
  // Reutiliza o cliente (mantém ligações HTTP abertas entre pedidos).
  cliente ??= new Anthropic({ apiKey, timeout: 45_000, maxRetries: 1 });
  return cliente;
}

export interface TalaoExtraido {
  valor: number | null; // total em euros, ponto decimal
  loja: string | null;
  data: string | null; // 'YYYY-MM-DD'
  categoria_sugerida: string;
  confianca: "alta" | "media" | "baixa";
}

// Esquema da resposta — a API garante JSON válido com exatamente esta forma
// (structured outputs), por isso não há parsing de texto nem cercas de código.
const TalaoSchema = z.object({
  valor: z.number().nullable().describe("TOTAL pago em euros (ex.: 12.5). null se ilegível."),
  loja: z.string().nullable().describe("Nome do estabelecimento. null se ilegível."),
  data: z.string().nullable().describe("Data da compra em YYYY-MM-DD. null se ilegível."),
  categoria_sugerida: z.string().describe("Uma das categorias fornecidas, exatamente como escrita."),
  confianca: z.enum(["alta", "media", "baixa"]),
});

const ILEGIVEL: TalaoExtraido = {
  valor: null,
  loja: null,
  data: null,
  categoria_sugerida: "Outros",
  confianca: "baixa",
};

// Garante 'YYYY-MM-DD' válido; caso contrário null.
function normalizarData(v: string | null): string | null {
  if (!v) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.trim());
  if (!m) return null;
  const [, a, mes, d] = m.map(Number);
  if (mes < 1 || mes > 12 || d < 1 || d > 31) return null;
  return v.trim();
}

const SISTEMA =
  "És um extrator de dados de talões/faturas de compras portugueses. " +
  "Lês a imagem e devolves os campos pedidos. Regras: usa o TOTAL final do talão " +
  "(não subtotais nem IVA isolado); converte datas PT (DD/MM/AAAA, DD-MM-AAAA) para YYYY-MM-DD; " +
  "se a imagem não for um talão ou estiver ilegível, devolve valor/loja/data a null e confianca 'baixa'.";

/**
 * Lê um talão a partir de uma imagem (base64) e devolve dados estruturados.
 * NÃO grava nada — apenas extrai para pré-preencher o formulário no cliente.
 */
export async function lerTalao(
  imagemBase64: string,
  mediaType: string,
  categorias: string[]
): Promise<TalaoExtraido> {
  const cliente = obterCliente();

  const tiposAceites = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
  const tipo = (tiposAceites as readonly string[]).includes(mediaType)
    ? (mediaType as (typeof tiposAceites)[number])
    : "image/jpeg";

  const listaCategorias = categorias.length ? categorias.join(", ") : "Outros";

  const resposta = await cliente.messages.parse({
    model: MODELO,
    max_tokens: 1024,
    // O prompt de sistema é fixo -> cacheável; o que varia (imagem, categorias) vem depois.
    system: [{ type: "text", text: SISTEMA, cache_control: { type: "ephemeral" } }],
    output_config: { format: zodOutputFormat(TalaoSchema), effort: "low" },
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: tipo, data: imagemBase64 } },
          {
            type: "text",
            text: `Extrai os dados deste talão. A categoria_sugerida TEM de ser uma destas: ${listaCategorias}.`,
          },
        ],
      },
    ],
  });

  if (resposta.stop_reason === "refusal" || !resposta.parsed_output) return ILEGIVEL;
  const bruto = resposta.parsed_output;

  // Garante que a categoria sugerida existe na lista (senão "Outros").
  const categoria =
    categorias.find((c) => c.toLowerCase() === bruto.categoria_sugerida.toLowerCase()) ??
    (categorias.includes("Outros") ? "Outros" : categorias[0] || "Outros");

  return {
    valor: bruto.valor !== null && Number.isFinite(bruto.valor) && bruto.valor >= 0 ? bruto.valor : null,
    loja: bruto.loja?.trim() || null,
    data: normalizarData(bruto.data),
    categoria_sugerida: categoria,
    confianca: bruto.confianca,
  };
}
