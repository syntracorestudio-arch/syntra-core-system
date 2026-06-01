/**
 * SYNTRA CORE — Sesión del panel interno (gate MVP).
 *
 * Token de sesión STATELESS firmado con HMAC-SHA256 + expiración.
 * - Sin store en DB (no hace falta para un acceso único compartido).
 * - Sin "server-only": lo usa el middleware (edge) Y el Server Action (node).
 * - Usa Web Crypto (crypto.subtle), disponible en ambos runtimes.
 *
 * Formato del token: `<exp>.<hmacHex>` donde exp = epoch segundos.
 * El cliente nunca puede forjarlo sin PANEL_SESSION_SECRET.
 * Extensible: migrar luego a Supabase Auth reemplazando este módulo.
 */

export const SESSION_COOKIE = "panel_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 8; // 8 horas

async function hmacHex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Comparación en tiempo constante (evita timing attacks). */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Crea un token firmado válido por SESSION_TTL_SECONDS. */
export async function createSessionToken(secret: string): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const sig = await hmacHex(secret, String(exp));
  return `${exp}.${sig}`;
}

/** Verifica firma + expiración. No confía en datos del cliente. */
export async function verifySessionToken(
  token: string | undefined,
  secret: string | undefined,
): Promise<boolean> {
  if (!token || !secret) return false;

  const dot = token.indexOf(".");
  if (dot <= 0) return false;

  const expStr = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;

  const expected = await hmacHex(secret, expStr);
  return safeEqual(expected, sig);
}
