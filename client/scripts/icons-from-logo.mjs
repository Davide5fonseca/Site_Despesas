// Gera os ícones da PWA (192, 512 e maskable 512) a partir de public/logo.png.
// O logótipo é centrado, com margem, sobre fundo branco (o logo já é navy+teal
// sobre branco). O maskable leva mais margem (zona segura dos ícones Android).
//
// Uso: node scripts/icons-from-logo.mjs   (precisa de sharp: npm i -D sharp)
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOGO = join(__dirname, "..", "public", "logo.png");
const OUT = join(__dirname, "..", "public", "icons");
mkdirSync(OUT, { recursive: true });

const BRANCO = { r: 255, g: 255, b: 255, alpha: 1 };

async function gerar(nome, size, margem) {
  const interno = Math.round(size * (1 - margem * 2));
  const logo = await sharp(LOGO)
    .resize(interno, interno, { fit: "contain", background: BRANCO })
    .toBuffer();
  const pad = Math.round((size - interno) / 2);
  await sharp({ create: { width: size, height: size, channels: 4, background: BRANCO } })
    .composite([{ input: logo, top: pad, left: pad }])
    .flatten({ background: BRANCO })
    .png()
    .toFile(join(OUT, nome));
  console.log("✓", nome, `(${size}x${size})`);
}

await gerar("icon-192.png", 192, 0.1);
await gerar("icon-512.png", 512, 0.1);
await gerar("icon-maskable-512.png", 512, 0.2);
console.log("Ícones gerados a partir de logo.png");
