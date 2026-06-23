import type { TalaoExtraido } from "../api/client";

// Leitura do QR FISCAL português (Autoridade Tributária). Quase todos os
// talões/faturas PT desde 2022 têm um QR com os dados estruturados — muito mais
// fiável que OCR. Formato: pares "K:valor" separados por "*". Campos úteis:
//   A = NIF do emitente (loja)   F = data (AAAAMMDD)   O = total com impostos
export interface TalaoQR {
  valor: number | null; // euros
  data: string | null; // YYYY-MM-DD
  nif: string | null; // NIF do emitente
}

// Lê o QR de uma imagem. Devolve null se não houver QR fiscal reconhecível.
export async function lerQRTalao(imagem: Blob): Promise<TalaoQR | null> {
  const texto = await descodificarQR(imagem);
  if (!texto) return null;
  return parseQRFiscal(texto);
}

// Junta o que veio do QR (exato) com o que veio do OCR/IA (loja, categoria).
// O QR manda no valor e na data; o OCR continua a dar a loja e a categoria.
export function mesclarQR(base: TalaoExtraido, qr: TalaoQR): TalaoExtraido {
  return {
    ...base,
    valor: qr.valor ?? base.valor,
    data: qr.data ?? base.data,
    nif: qr.nif ?? base.nif ?? null,
    confianca: qr.valor !== null ? "alta" : base.confianca,
  };
}

// ──────────────────────── Descodificação da imagem ────────────────────────
async function descodificarQR(imagem: Blob): Promise<string | null> {
  const fonte = await carregarFonte(imagem);
  try {
    // Mantém boa resolução para o QR, mas limita a memória.
    const lado = 2000;
    let { width, height } = fonte;
    if (Math.max(width, height) > lado) {
      const escala = lado / Math.max(width, height);
      width = Math.round(width * escala);
      height = Math.round(height * escala);
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(fonte.imagem as CanvasImageSource, 0, 0, width, height);
    const dados = ctx.getImageData(0, 0, width, height);

    const { default: jsQR } = await import("jsqr");
    const r = jsQR(dados.data, width, height, { inversionAttempts: "attemptBoth" });
    return r?.data ?? null;
  } finally {
    fonte.limpar();
  }
}

interface Fonte {
  imagem: ImageBitmap | HTMLImageElement;
  width: number;
  height: number;
  limpar: () => void;
}

async function carregarFonte(imagem: Blob): Promise<Fonte> {
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(imagem);
      return { imagem: bmp, width: bmp.width, height: bmp.height, limpar: () => bmp.close() };
    } catch {
      // cai no método com <img>
    }
  }
  const url = URL.createObjectURL(imagem);
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = url;
  });
  return {
    imagem: img,
    width: img.naturalWidth,
    height: img.naturalHeight,
    limpar: () => URL.revokeObjectURL(url),
  };
}

// ──────────────────────── Parsing do formato AT ────────────────────────
// Exportada para testes.
export function parseQRFiscal(texto: string): TalaoQR | null {
  if (!texto || !texto.includes("*")) return null;

  const campos: Record<string, string> = {};
  for (const par of texto.split("*")) {
    const i = par.indexOf(":");
    if (i > 0) campos[par.slice(0, i).trim()] = par.slice(i + 1).trim();
  }

  // Só tratamos como QR fiscal se tiver o NIF do emitente (campo A).
  if (!/^\d{9}$/.test(campos.A ?? "")) return null;

  const valor = campos.O ? paraNumero(campos.O) : null;
  const data = campos.F ? dataAT(campos.F) : null;
  if (valor === null && data === null) return null; // nada de útil

  return { valor, data, nif: campos.A };
}

// O total no QR fiscal vem com ponto decimal: "23.45".
function paraNumero(s: string): number | null {
  const n = Number(s.replace(",", ".").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function dataAT(s: string): string | null {
  const m = /^(\d{4})(\d{2})(\d{2})$/.exec(s);
  if (!m) return null;
  const [, a, mes, d] = m;
  const mm = Number(mes);
  const dd = Number(d);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  return `${a}-${mes}-${d}`;
}
