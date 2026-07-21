/** Formateo de plata en pesos argentinos, sin decimales (el kiosco no los usa). */
export function money(n: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);
}

/** Porcentaje con signo explícito — el signo importa tanto como el color (a11y). */
export function signedPct(n: number): string {
  const s = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${s}${Math.abs(n).toFixed(0)}%`;
}
