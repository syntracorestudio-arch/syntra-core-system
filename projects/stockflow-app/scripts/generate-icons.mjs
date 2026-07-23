/**
 * Genera los íconos del PWA a partir del isotipo de la marca (cubo 3D + flecha).
 *
 * Se corre a mano cuando cambia la identidad: `node scripts/generate-icons.mjs`.
 * Los PNG resultantes se commitean (son assets, no build output).
 *
 * La fuente de verdad del dibujo es `src/components/brand/logo-3d.tsx`; acá los
 * `color-mix()`/tokens van HORNEADOS a hex porque librsvg (sharp) no resuelve CSS
 * moderno. Si cambia el isotipo, cambiar los dos lugares.
 *
 * El badge de Android es aparte y MONOCROMO: el sistema lo recorta como silueta,
 * así que un ícono a color se ve como una mancha (lección de StudioFlow).
 */
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const PUB = new URL("../public/", import.meta.url);
const APP = new URL("../src/app/", import.meta.url);

// Tokens horneados (tema default; los íconos instalados no son white-label):
// --primary #2E6BFF · --primary-ink #6D9BFF · base #0A0D13 · piso #05070C.
// Caras del cubo = color-mix(primary N%, #05070c) precalculado: 24% / 12% / 6%.
const CARA_TOP = "#0F1F46";
const CARA_IZQ = "#0A1329";
const CARA_DER = "#070D1B";

const DEFS = `
  <defs>
    <linearGradient id="g-flecha" x1="2" y1="34" x2="45" y2="20" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#6D9BFF"/>
      <stop offset="1" stop-color="#AFC8FF"/>
    </linearGradient>
    <radialGradient id="g-piso" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#05070C" stop-opacity="0.9"/>
      <stop offset="1" stop-color="#05070C" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="g-ambiente" cx="0.5" cy="0.38" r="0.75">
      <stop offset="0" stop-color="#2E6BFF" stop-opacity="0.16"/>
      <stop offset="1" stop-color="#2E6BFF" stop-opacity="0"/>
    </radialGradient>
  </defs>`;

/**
 * El isotipo en su espacio local (viewBox 0 0 48 52), espejo de logo-3d.tsx.
 * La sombra de contacto solo tiene sentido sobre el fondo de la app: en el
 * favicon transparente quedaría flotando como una mancha gris.
 */
const marca = (conPiso) => `
  ${conPiso ? '<ellipse cx="24" cy="46.5" rx="13" ry="3" fill="url(#g-piso)"/>' : ""}
  <path d="M24 5 39 13.5 24 22 9 13.5Z" fill="${CARA_TOP}"/>
  <path d="M9 13.5 24 22V39L9 30.5Z" fill="${CARA_IZQ}"/>
  <path d="M24 22 39 13.5V30.5L24 39Z" fill="${CARA_DER}"/>
  <g fill="none" stroke-linejoin="round" stroke-linecap="round">
    <path d="M24 5 39 13.5V30.5L24 39 9 30.5V13.5Z" stroke="#2E6BFF" stroke-width="1.8"/>
    <path d="M9 13.5 24 22 39 13.5" stroke="#2E6BFF" stroke-width="1.5"/>
    <path d="M24 22V39" stroke="#2E6BFF" stroke-width="1.5"/>
    <path d="M9 13.5 24 5l15 8.5" stroke="#6D9BFF" stroke-opacity="0.85" stroke-width="1"/>
  </g>
  <g transform="translate(0.7 1.1)" fill="none" stroke="#05070C" stroke-opacity="0.45"
     stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M2 34h9.5L24 26l9 5.5L44.5 21"/>
    <path d="M37 20.5h7.5V28"/>
  </g>
  <g fill="none" stroke="url(#g-flecha)" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M2 34h9.5L24 26l9 5.5L44.5 21"/>
    <path d="M37 20.5h7.5V28"/>
  </g>
  <path d="M2.5 33.4h9L24 25.4l9 5.5L44 20.6" fill="none" stroke="#FFFFFF" stroke-opacity="0.35"
        stroke-width="0.9" stroke-linecap="round" stroke-linejoin="round"/>`;

/**
 * Ícono de app: el isotipo sobre la base oscura de la app con un ambiente azul
 * sutil (mismo clima que el login). Maskable = full-bleed con margen porque
 * Android recorta (safe zone: círculo central del 80%).
 */
const icono = (maskable) => {
  const s = maskable ? 5.6 : 6.5;
  const x = (512 - 48 * s) / 2;
  const y = (512 - 52 * s) / 2;
  const rx = maskable ? 0 : 112;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  ${DEFS}
  <rect width="512" height="512" rx="${rx}" fill="#0A0D13"/>
  <rect width="512" height="512" rx="${rx}" fill="url(#g-ambiente)"/>
  <g transform="translate(${x} ${y}) scale(${s})">${marca(true)}</g>
</svg>`;
};

/** Favicon: el isotipo solo, sobre transparente (funciona en tab clara y oscura). */
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 48 45">
  ${DEFS}
  ${marca(false)}
</svg>`;

/** Badge: silueta blanca del cubo + flecha sobre transparente (máscara Android). */
const badge = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 48 52">
  <g fill="none" stroke="#FFFFFF" stroke-linejoin="round" stroke-linecap="round">
    <path d="M24 5 39 13.5V30.5L24 39 9 30.5V13.5Z" stroke-width="3.6"/>
    <path d="M2 34h9.5L24 26l9 5.5L44.5 21" stroke-width="5"/>
    <path d="M37 20.5h7.5V28" stroke-width="5"/>
  </g>
</svg>`;

const png = (svg, size) =>
  sharp(Buffer.from(svg), { density: 300 })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toBuffer();

/** ICO con PNGs adentro (válido para todo navegador moderno). */
function pngsToIco(entradas) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2); // tipo: ícono
  header.writeUInt16LE(entradas.length, 4);
  let offset = 6 + 16 * entradas.length;
  const dirs = [];
  for (const { size, buf } of entradas) {
    const d = Buffer.alloc(16);
    d.writeUInt8(size === 256 ? 0 : size, 0);
    d.writeUInt8(size === 256 ? 0 : size, 1);
    d.writeUInt16LE(1, 4); // planos
    d.writeUInt16LE(32, 6); // bpp
    d.writeUInt32LE(buf.length, 8);
    d.writeUInt32LE(offset, 12);
    offset += buf.length;
    dirs.push(d);
  }
  return Buffer.concat([header, ...dirs, ...entradas.map((e) => e.buf)]);
}

await mkdir(PUB, { recursive: true });

const tareas = [
  { svg: icono(false), file: "icon-512.png", size: 512 },
  { svg: icono(false), file: "icon-192.png", size: 192 },
  { svg: icono(true), file: "icon-maskable-512.png", size: 512 },
  { svg: badge, file: "badge-96.png", size: 96 },
  { svg: favicon, file: "favicon.png", size: 64 },
];

for (const t of tareas) {
  await writeFile(fileURLToPath(new URL(t.file, PUB)), await png(t.svg, t.size));
  console.log(`✓ ${t.file}`);
}

// Favicon .ico (lo sirve Next desde src/app/): 16/32/48 para que la tab se vea
// nítida en cualquier densidad.
const ico = pngsToIco(
  await Promise.all(
    [16, 32, 48].map(async (size) => ({ size, buf: await png(favicon, size) })),
  ),
);
await writeFile(fileURLToPath(new URL("favicon.ico", APP)), ico);
console.log("✓ src/app/favicon.ico");
