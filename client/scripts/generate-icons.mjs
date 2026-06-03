// Gera os ícones PNG da PWA (192, 512 e maskable 512) sem dependências externas.
// Desenha um "€" branco sobre fundo teal, em píxeis, e codifica PNG com zlib nativo.
//
// Uso: node scripts/generate-icons.mjs
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "public", "icons");
mkdirSync(OUT, { recursive: true });

// ── CRC32 + PNG ───────────────────────────────────────────────────────────
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}
function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  // scanlines com filtro 0
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ── Desenho ──────────────────────────────────────────────────────────────
const lerp = (a, b, t) => a + (b - a) * t;

function drawIcon(size, maskable) {
  const buf = Buffer.alloc(size * size * 4);
  const cx = size / 2;
  const cy = size / 2;
  const radiusCorner = maskable ? 0 : size * 0.22;

  // Geometria do "€"
  const R = size * (maskable ? 0.24 : 0.28); // raio exterior do arco
  const t = size * 0.085; // espessura do traço
  const gap = (42 * Math.PI) / 180; // abertura do "C" à direita
  const barH = size * 0.072; // espessura das barras horizontais
  const barL = cx - R * 1.18; // x inicial das barras
  const barR = cx + R * 0.12; // x final das barras
  const bar1 = cy - size * 0.045;
  const bar2 = cy + size * 0.045;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;

      // Fundo (com cantos arredondados nos ícones normais)
      let dentro = true;
      if (radiusCorner > 0) {
        const rx = Math.min(x, size - 1 - x);
        const ry = Math.min(y, size - 1 - y);
        if (rx < radiusCorner && ry < radiusCorner) {
          const dx = radiusCorner - rx;
          const dy = radiusCorner - ry;
          if (dx * dx + dy * dy > radiusCorner * radiusCorner) dentro = false;
        }
      }
      if (!dentro) {
        buf[i] = buf[i + 1] = buf[i + 2] = buf[i + 3] = 0;
        continue;
      }

      // Gradiente vertical teal
      const tt = y / size;
      buf[i] = Math.round(lerp(0x14, 0x0f, tt)); // R: 20->15
      buf[i + 1] = Math.round(lerp(0xa0, 0x76, tt)); // G:160->118
      buf[i + 2] = Math.round(lerp(0x8a, 0x6e, tt)); // B:138->110
      buf[i + 3] = 255;

      // "€" branco
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.hypot(dx, dy);
      const ang = Math.atan2(dy, dx); // -pi..pi, 0 = direita

      const noArco = dist >= R - t && dist <= R && Math.abs(ang) > gap;
      const naBarra =
        x >= barL &&
        x <= barR &&
        ((Math.abs(y - bar1) <= barH / 2) || (Math.abs(y - bar2) <= barH / 2));

      if (noArco || naBarra) {
        buf[i] = 255;
        buf[i + 1] = 255;
        buf[i + 2] = 255;
        buf[i + 3] = 255;
      }
    }
  }
  return buf;
}

function gerar(nome, size, maskable) {
  const png = encodePNG(size, size, drawIcon(size, maskable));
  writeFileSync(join(OUT, nome), png);
  console.log("✓", nome, `(${size}x${size}${maskable ? ", maskable" : ""})`);
}

gerar("icon-192.png", 192, false);
gerar("icon-512.png", 512, false);
gerar("icon-maskable-512.png", 512, true);
console.log("Ícones gerados em public/icons/");
