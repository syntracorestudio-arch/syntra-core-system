/**
 * date.ts — fechas del negocio como strings YYYY-MM-DD ("plain date"), sin hora.
 *
 * Toda operación arma el Date a mediodía UTC (`T12:00:00Z`) para que sumar días o
 * cambiar de mes nunca resbale de día por DST ni por el offset del server. Y el "hoy"
 * SIEMPRE se calcula en la zona DEL NEGOCIO, no la del server (UTC) ni la del browser:
 * un kiosco que cierra 23:00 ART no puede ver "mañana" porque el server está en UTC.
 *
 * Centraliza lo que antes vivía duplicado inline en caja-client, reportes/page y
 * reportes-client (irA, fechaLarga, rango, iso, etiqueta, rangoTexto).
 */

export type Periodo = "semana" | "mes" | "anio";

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

/** El piso de lectura: 24 meses = 730 días, igual que el clamp de las RPC de reportes. */
export const MAX_LOOKBACK_DAYS = 730;

export function isYMD(s: string | null | undefined): s is string {
  return typeof s === "string" && YMD_RE.test(s);
}

/** Hoy en la zona del negocio, como YYYY-MM-DD (en-CA da formato ISO). */
export function todayInTz(tz: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
}

/** Date a mediodía UTC del YMD dado — evita corrimientos de día. */
function atNoon(ymd: string): Date {
  return new Date(`${ymd}T12:00:00Z`);
}

/** Date (mediodía UTC) → YYYY-MM-DD. */
function toYMD(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function yearOf(ymd: string): number {
  return Number(ymd.slice(0, 4));
}
export function monthOf(ymd: string): number {
  return Number(ymd.slice(5, 7)) - 1; // 0-index, como Date
}
export function dayOf(ymd: string): number {
  return Number(ymd.slice(8, 10));
}
export function sameMonth(a: string, b: string): boolean {
  return a.slice(0, 7) === b.slice(0, 7);
}

export function addDays(ymd: string, n: number): string {
  const d = atNoon(ymd);
  d.setUTCDate(d.getUTCDate() + n);
  return toYMD(d);
}

/** Primer día del mes que contiene ymd. */
export function startOfMonth(ymd: string): string {
  return `${ymd.slice(0, 7)}-01`;
}

/** Último día del mes que contiene ymd. */
export function endOfMonth(ymd: string): string {
  const d = atNoon(ymd);
  return toYMD(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 12)));
}

/** Lunes de la semana que contiene ymd (semana AR: lunes → domingo). */
export function startOfWeekMonday(ymd: string): string {
  const dow = (atNoon(ymd).getUTCDay() + 6) % 7; // 0 = lunes
  return addDays(ymd, -dow);
}

export function startOfYear(ymd: string): string {
  return `${ymd.slice(0, 4)}-01-01`;
}
export function endOfYear(ymd: string): string {
  return `${ymd.slice(0, 4)}-12-31`;
}

/** Mueve el mes visible n meses (para la nav del calendario/MonthPicker). */
export function addMonths(ymd: string, n: number): string {
  const d = atNoon(ymd);
  return toYMD(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1, 12)));
}

/**
 * Rango [from,to] del período que contiene el anchor. Reemplaza rango(periodo,offset):
 * ahora se calcula desde una fecha ABSOLUTA, no desde un offset relativo a hoy.
 */
export function rangeFor(periodo: Periodo, anchor: string): { from: string; to: string } {
  if (periodo === "semana") {
    const from = startOfWeekMonday(anchor);
    return { from, to: addDays(from, 6) };
  }
  if (periodo === "mes") {
    return { from: startOfMonth(anchor), to: endOfMonth(anchor) };
  }
  return { from: startOfYear(anchor), to: endOfYear(anchor) };
}

/** Encajona el anchor: nunca futuro, nunca más viejo que el piso de 24 meses. */
export function clampAnchor(anchor: string, today: string): string {
  const floor = addDays(today, -MAX_LOOKBACK_DAYS);
  if (anchor > today) return today;
  if (anchor < floor) return floor;
  return anchor;
}

// ── Etiquetas ────────────────────────────────────────────────────────────────

export const DIAS_SEMANA = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"] as const;
export const MESES_CORTOS = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
] as const;

const F_LARGA = new Intl.DateTimeFormat("es-AR", {
  weekday: "long", day: "numeric", month: "long", timeZone: "UTC",
});
const F_CORTA = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", timeZone: "UTC" });
const F_MES_ANIO = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric", timeZone: "UTC" });

function capitalizar(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "Lunes 15 de marzo" — subtítulo de Caja. */
export function formatLongDate(ymd: string): string {
  return capitalizar(F_LARGA.format(atNoon(ymd)));
}

/** "15 mar" — trigger compacto del día. */
export function formatShortDate(ymd: string): string {
  return F_CORTA.format(atNoon(ymd));
}

/** "Marzo 2026" — encabezado del calendario / MonthPicker. */
export function formatMonthYear(ymd: string): string {
  return capitalizar(F_MES_ANIO.format(atNoon(ymd)));
}

/** Etiqueta del rango según granularidad ("1 – 31 mar" · "2026"). */
export function formatRangeLabel(periodo: Periodo, from: string, to: string): string {
  if (periodo === "anio") return from.slice(0, 4);
  return `${F_CORTA.format(atNoon(from))} – ${F_CORTA.format(atNoon(to))}`;
}
