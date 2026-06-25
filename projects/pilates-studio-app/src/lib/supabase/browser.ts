import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { publicEnv } from "./env";

/**
 * Cliente Supabase para el browser (anon key). Respeta RLS.
 * Singleton para no recrear el cliente en cada render.
 * (Fase 1D-0: sin @supabase/ssr todavía; auth de sesión llega en una fase posterior.)
 */
let client: SupabaseClient | undefined;

export function getSupabaseBrowser(): SupabaseClient {
  if (!client) {
    client = createClient(
      publicEnv.NEXT_PUBLIC_SUPABASE_URL,
      publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    );
  }
  return client;
}
