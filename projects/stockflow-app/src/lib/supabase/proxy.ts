import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv, isSupabaseConfigured } from "./env";

/** Rutas que exigen sesión. Toda ruta privada nueva se agrega ACÁ y al matcher. */
const PROTECTED_PREFIXES = ["/pos", "/admin", "/super"] as const;

/**
 * Refresca la sesión de Supabase en cada request y protege rutas.
 * Usa anon key + cookies (RLS), nunca service_role.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Tanda 1A: el proyecto de Supabase todavía no existe. En dev dejamos pasar para
  // poder revisar la UI; en prod `env.ts` ya lanzó al importar, así que esto no corre.
  if (!isSupabaseConfigured) {
    return response;
  }

  const supabase = createServerClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getUser() revalida el token contra Supabase (no confiar en getSession en server).
  // try/catch: si Supabase Auth parpadea, la app NO devuelve 500 en cada request —
  // lo público sigue andando y lo protegido degrada a /login con aviso.
  let user: { id: string } | null = null;
  let authDown = false;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    authDown = true;
  }

  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some((p) => path.startsWith(p));

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    if (authDown) {
      url.searchParams.set(
        "error",
        "Servicio momentáneamente no disponible. Probá de nuevo en un minuto.",
      );
    }
    return NextResponse.redirect(url);
  }

  return response;
}
