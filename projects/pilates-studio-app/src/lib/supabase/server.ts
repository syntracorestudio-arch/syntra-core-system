import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { publicEnv } from "./env";

/**
 * Cliente Supabase para Server Components / Server Actions / Route Handlers.
 * Usa la **anon key** + cookies SSR → opera con la sesión del usuario y respeta RLS.
 * NO usa service_role (eso es solo para admin tooling / health check).
 */
export async function createSupabaseServer() {
  const cookieStore = await cookies();

  return createServerClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Invocado desde un Server Component (cookies read-only):
            // el middleware se encarga de refrescar la sesión. Ignorar.
          }
        },
      },
    },
  );
}
