import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Middleware de Next: refresca la sesión Supabase y protege /app.
 * (En proyectos con src/, el archivo de middleware vive en src/middleware.ts.)
 */
export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // Excluye estáticos y assets; corre en el resto (incl. /app y /login).
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
