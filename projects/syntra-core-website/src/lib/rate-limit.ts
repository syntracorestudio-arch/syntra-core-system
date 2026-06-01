import "server-only";

/**
 * SYNTRA CORE — Rate limiter (ventana fija, in-memory).
 *
 * Baseline de protección anti-abuso para la Server Action de leads.
 *
 * ⚠️ In-memory: el estado vive por instancia y se reinicia en cold starts;
 * en un deploy serverless multi-instancia no es compartido. Suficiente como
 * primera barrera. Para producción a escala, reemplazar `hit()` por un store
 * distribuido (Upstash Redis / @vercel/kv) manteniendo la misma firma.
 */

interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
}

interface Entry {
  count: number;
  resetAt: number;
}

const store = new Map<string, Entry>();

const DEFAULT_MAX = 5;
const DEFAULT_WINDOW_MS = 10 * 60 * 1000; // 10 minutos

/** Poda perezosa para evitar crecimiento ilimitado del Map. */
function prune(now: number): void {
  if (store.size < 5000) return;
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}

export function rateLimit(
  key: string,
  max: number = DEFAULT_MAX,
  windowMs: number = DEFAULT_WINDOW_MS,
): RateLimitResult {
  const now = Date.now();
  prune(now);

  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: max - 1, retryAfterSec: 0 };
  }

  if (entry.count >= max) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSec: Math.ceil((entry.resetAt - now) / 1000),
    };
  }

  entry.count += 1;
  return { ok: true, remaining: max - entry.count, retryAfterSec: 0 };
}
