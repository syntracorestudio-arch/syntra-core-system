import { createAdminClient } from "./supabase/admin";

/**
 * Rate limiting — baseline `syntra-scale-security-baseline`, desde el primer commit.
 * (StudioFlow lo agregó recién en su migración 033, tras una auditoría.)
 *
 * Contador en Postgres, sin Redis: a escala SYNTRA (<10³ req/min) alcanza y sobra.
 * Se apoya en la RPC `check_rate_limit(p_key, p_max, p_window)` de la migración 001.
 *
 * **FAIL-OPEN**: si la RPC falla, NO se bloquea al usuario legítimo. Un rate limiter
 * caído nunca puede tirar abajo la caja de un kiosco.
 */
export async function checkRateLimit(
  key: string,
  max: number,
  windowSeconds: number,
): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("check_rate_limit", {
      p_key: key,
      p_max: max,
      p_window_seconds: windowSeconds,
    });
    if (error) return true; /* fail-open */
    return data !== false;
  } catch {
    return true; /* fail-open */
  }
}

/** Identificador de cliente para la clave de rate limit (proxy-aware). */
export function clientKey(request: Request, scope: string): string {
  const fwd = request.headers.get("x-forwarded-for");
  const ip = fwd?.split(",")[0]?.trim() || "unknown";
  return `${scope}:${ip}`;
}
