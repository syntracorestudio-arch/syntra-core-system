import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { publicEnv, getServerEnv } from "./env";

/**
 * Cliente Supabase ADMIN (service_role) — **server-only**.
 * BYPASSA RLS: usar solo en código de servidor (route handlers, server actions),
 * nunca en componentes cliente. Tiene guarda anti-browser y no persiste sesión.
 * La service_role NUNCA debe exponerse al browser ni llevar prefijo NEXT_PUBLIC.
 */
export function createAdminClient(): SupabaseClient {
  if (typeof window !== "undefined") {
    throw new Error("createAdminClient(): el cliente admin es server-only.");
  }
  const { SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();
  return createClient(publicEnv.NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
