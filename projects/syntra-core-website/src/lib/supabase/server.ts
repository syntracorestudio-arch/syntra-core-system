import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * SYNTRA CORE — Cliente Supabase server-only.
 *
 * Usa la SERVICE ROLE KEY: nunca se envía al cliente (import "server-only" lo
 * garantiza). La escritura de leads ocurre solo en Server Actions. La tabla
 * tiene RLS activo que bloquea todo acceso anónimo; la service role lo omite
 * de forma segura desde el servidor.
 *
 * Devuelve null si faltan las variables de entorno (fallback de desarrollo).
 */
let cached: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient | null {
  if (cached) return cached;

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return null;
  }

  cached = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return cached;
}

/** True si Supabase está configurado (env presentes). */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}
