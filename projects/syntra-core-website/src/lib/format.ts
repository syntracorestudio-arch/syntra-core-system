/**
 * Formateo de fechas para el panel. Usado solo en Server Components
 * (render server-side → sin riesgo de hydration mismatch).
 */
const dateFormatter = new Intl.DateTimeFormat("es", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDateTime(iso: string): string {
  return dateFormatter.format(new Date(iso));
}
