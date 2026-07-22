/**
 * Genera los íconos del PWA a partir de un SVG, con los colores de la marca.
 *
 * Se corre a mano cuando cambia la identidad: `node scripts/generate-icons.mjs`.
 * Los PNG resultantes se commitean (son assets, no build output).
 *
 * El badge de Android es aparte y MONOCROMO: el sistema lo recorta como silueta,
 * así que un ícono a color se ve como una mancha (lección de StudioFlow).
 */
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const OUT = new URL("../public/", import.meta.url);

/** Ícono principal: la marca sobre el azul de StockFlow. */
const icono = (size, padding) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${padding ? 0 : 112}" fill="#2E6BFF"/>
  <g transform="translate(0,${padding ? 0 : -8})">
    <text x="256" y="322" font-family="system-ui, -apple-system, Segoe UI, sans-serif"
          font-size="210" font-weight="700" fill="#FFFFFF" text-anchor="middle"
          letter-spacing="-6">SF</text>
  </g>
</svg>`;

/** Badge: silueta blanca sobre transparente. Android lo usa como máscara. */
const badge = `
<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
  <path fill="#FFFFFF" d="M48 12c-11 0-20 9-20 20v14l-7 12v5h54v-5l-7-12V32c0-11-9-20-20-20zm0 72c5 0 9-4 9-9H39c0 5 4 9 9 9z"/>
</svg>`;

await mkdir(OUT, { recursive: true });

const tareas = [
  { svg: icono(512, false), file: "icon-512.png", size: 512 },
  { svg: icono(192, false), file: "icon-192.png", size: 192 },
  // Maskable: sin esquinas redondeadas y con margen, porque Android recorta.
  { svg: icono(512, true), file: "icon-maskable-512.png", size: 512 },
  { svg: badge, file: "badge-96.png", size: 96 },
];

for (const t of tareas) {
  await sharp(Buffer.from(t.svg))
    .resize(t.size, t.size)
    .png({ compressionLevel: 9 })
    .toFile(new URL(t.file, OUT).pathname.replace(/^\//, ""));
  console.log(`✓ ${t.file}`);
}

// Favicon para el navegador de escritorio.
await sharp(Buffer.from(icono(64, false)))
  .resize(64, 64)
  .png()
  .toFile(new URL("favicon.png", OUT).pathname.replace(/^\//, ""));
console.log("✓ favicon.png");
