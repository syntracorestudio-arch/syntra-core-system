/**
 * SYNTRA CORE — Tracking de eventos (pluggable).
 *
 * Util tipado con transporte intercambiable. Por defecto: no-op en producción,
 * console en desarrollo. Para conectar un provider (Vercel Analytics, endpoint
 * propio, etc.) basta con reemplazar `transport`. Cero dependencias.
 */

export type AnalyticsEvent =
  | "cta_click"
  | "lead_submit_attempt"
  | "lead_submitted"
  | "lead_submit_error";

export type EventProps = Record<string, string | number | boolean | undefined>;

type Transport = (event: AnalyticsEvent, props?: EventProps) => void;

const isDev = process.env.NODE_ENV === "development";

/** Transporte por defecto: log en dev, no-op en prod. Reemplazable. */
const transport: Transport = (event, props) => {
  if (isDev) {
    console.info(`[analytics] ${event}`, props ?? {});
  }
};

export function track(event: AnalyticsEvent, props?: EventProps): void {
  try {
    transport(event, props);
  } catch {
    // El tracking nunca debe romper la UX.
  }
}
