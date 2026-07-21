import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

/**
 * Convención `proxy` de Next 16 (reemplaza al viejo `middleware`).
 * Refresca la sesión de Supabase y protege las rutas privadas.
 */
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /**
     * Todo salvo estáticos y assets. Las rutas protegidas concretas se listan en
     * PROTECTED_PREFIXES (lib/supabase/proxy.ts) — mantener ambos en sync.
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)",
  ],
};
