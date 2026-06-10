/**
 * SYNTRA CORE — Tracking de eventos (pluggable).
 *
 * Util tipado con transporte intercambiable. Por defecto: no-op en producción,
 * console en desarrollo. Para conectar un provider (Vercel Analytics, endpoint
 * propio, etc.) basta con reemplazar `transport`. Cero dependencias.
 */

export type AnalyticsEvent =
  | "cta_click"
  | "form_start"
  | "lead_submit_attempt"
  | "lead_submitted"
  | "lead_submit_error"
  | "application_tab_click";

export type EventProps = Record<string, string | number | boolean | undefined>;

type Transport = (event: AnalyticsEvent, props?: EventProps) => void;

const isDev = process.env.NODE_ENV === "development";

declare global {
  interface Window {
    /** Cola/función de Plausible (custom events). Puede no existir aún. */
    plausible?: (
      event: string,
      opts?: { props?: Record<string, string | number | boolean> },
    ) => void;
  }
}

/** Quita props undefined (Plausible solo acepta valores definidos). */
function cleanProps(props?: EventProps): Record<string, string | number | boolean> | undefined {
  if (!props) return undefined;
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(props)) {
    if (v !== undefined) out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * Transporte: log en dev + envío real a Plausible si está disponible.
 * A prueba de ausencia de `window.plausible` (no rompe si no cargó / no hay dominio).
 */
const transport: Transport = (event, props) => {
  if (isDev) {
    console.info(`[analytics] ${event}`, props ?? {});
  }
  if (typeof window !== "undefined" && typeof window.plausible === "function") {
    const clean = cleanProps(props);
    window.plausible(event, clean ? { props: clean } : undefined);
  }
};

export function track(event: AnalyticsEvent, props?: EventProps): void {
  try {
    transport(event, props);
  } catch {
    // El tracking nunca debe romper la UX.
  }
}
