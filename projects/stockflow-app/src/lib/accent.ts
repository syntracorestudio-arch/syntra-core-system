/**
 * White-label sobre fondo DARK.
 *
 * `--primary` es el único token que cada negocio reemplaza por su color de marca
 * (ver docs/reference-locks/paleta-dark.md). Sobre un lienzo casi negro hacen falta
 * DOS derivados para que cualquier acento siga siendo legible:
 *
 *  - `accentForeground()` → texto sobre el FILL del acento (botón).
 *  - `accentInk()`        → el acento como TEXTO/link sobre el fondo dark. Un azul de
 *                           marca lindo suele fallar AA como texto sobre #0a0d13, así
 *                           que se lo aclara hasta alcanzar el contraste mínimo.
 *
 * Diferencia con StudioFlow (lienzo claro): allá el riesgo era un acento demasiado
 * CLARO; acá es un acento demasiado OSCURO. La guarda es la simétrica.
 */

const BACKGROUND_LUMINANCE = 0.0055; /* #0a0d13 */
const AA_CONTRAST = 4.5;

type Rgb = { r: number; g: number; b: number };

function parseHex(hex: string | null | undefined): Rgb | null {
  const m = /^#?([0-9a-fA-F]{6})$/.exec((hex ?? "").trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function toHex({ r, g, b }: Rgb): string {
  const c = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Luminancia relativa sRGB (WCAG). */
function luminance({ r, g, b }: Rgb): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Contraste WCAG contra el fondo dark de la app. */
function contrastOnBackground(rgb: Rgb): number {
  return (luminance(rgb) + 0.05) / (BACKGROUND_LUMINANCE + 0.05);
}

/**
 * Texto legible sobre el FILL del acento del negocio.
 * Acento oscuro → blanco; acento claro (amarillo, lima) → tinta oscura.
 */
export function accentForeground(hex: string | null | undefined): string {
  const rgb = parseHex(hex);
  if (!rgb) return "#ffffff";
  return luminance(rgb) > 0.45 ? "#0a0d13" : "#ffffff";
}

/**
 * El acento como TEXTO/link sobre el fondo dark: se aclara hacia blanco hasta
 * alcanzar AA (4.5:1). Si el acento ya pasa, se devuelve intacto.
 */
export function accentInk(hex: string | null | undefined): string {
  const rgb = parseHex(hex);
  if (!rgb) return "#6d9bff"; /* default de la paleta */

  let current = rgb;
  /* Mezcla progresiva con blanco (5% por paso) — preserva el hue de marca. */
  for (let step = 0; step <= 20; step++) {
    if (contrastOnBackground(current) >= AA_CONTRAST) return toHex(current);
    const t = (step + 1) * 0.05;
    current = {
      r: rgb.r + (255 - rgb.r) * t,
      g: rgb.g + (255 - rgb.g) * t,
      b: rgb.b + (255 - rgb.b) * t,
    };
  }
  return "#ffffff";
}

/**
 * Variables CSS del acento para inyectar en el layout del negocio.
 * Uso: <div style={accentStyle(store.branding.accent)}>
 */
export function accentStyle(hex: string | null | undefined): React.CSSProperties {
  const accent = parseHex(hex) ? (hex as string) : "#2e6bff";
  return {
    "--primary": accent,
    "--primary-foreground": accentForeground(accent),
    "--primary-ink": accentInk(accent),
    "--ring": accent,
  } as React.CSSProperties;
}

/**
 * Guarda de colisión: avisa si el acento elegido se parece al verde de "ganancia"
 * o al rojo de "sin stock". Avisa, NO bloquea (filosofía del producto: la decisión
 * es del dueño). Devuelve el semántico con el que choca, o null.
 */
export function accentCollision(hex: string | null | undefined): "success" | "danger" | null {
  const rgb = parseHex(hex);
  if (!rgb) return null;
  const hue = hueOf(rgb);
  if (hue === null) return null;
  if (Math.abs(hue - 142) <= 25) return "success"; /* #22c55e */
  if (Math.abs(hue - 0) <= 25 || Math.abs(hue - 360) <= 25) return "danger"; /* #ef4444 */
  return null;
}

function hueOf({ r, g, b }: Rgb): number | null {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  if (d === 0) return null; /* gris: no colisiona con nada */
  let h: number;
  if (max === rn) h = ((gn - bn) / d) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  h *= 60;
  return h < 0 ? h + 360 : h;
}
