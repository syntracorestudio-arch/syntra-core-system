import { createBrowserClient } from "@supabase/ssr";
import { type SupabaseClient } from "@supabase/supabase-js";
import { publicEnv } from "./env";

/**
 * Cliente Supabase para el browser (anon key, respeta RLS) con manejo de sesión
 * vía cookies SSR (@supabase/ssr). Singleton para no recrear el cliente.
 */
let client: SupabaseClient | undefined;

export function getSupabaseBrowser(): SupabaseClient {
  if (!client) {
    client = createBrowserClient(
      publicEnv.NEXT_PUBLIC_SUPABASE_URL,
      publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    );
  }
  return client;
}
