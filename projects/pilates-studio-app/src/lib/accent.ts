/**
 * Color de texto (claro u oscuro) con mejor contraste sobre el acento del estudio.
 * Guarda white-label: un estudio puede elegir un acento claro → el CTA debe seguir
 * legible (AA). Calcula la luminancia relativa sRGB y elige blanco o el foreground cálido.
 */
export function accentForeground(hex: string | null | undefined): string {
  const m = /^#?([0-9a-fA-F]{6})$/.exec((hex ?? "").trim());
  if (!m) return "#ffffff";
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.45 ? "#3F3A34" : "#ffffff";
}
