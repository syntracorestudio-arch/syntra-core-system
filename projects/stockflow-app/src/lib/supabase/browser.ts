import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "./env";

/**
 * Cliente Supabase para Client Components.
 * Usa la **anon key** → opera con la sesión del usuario y respeta RLS.
 */
export function createSupabaseBrowser() {
  return createBrowserClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
