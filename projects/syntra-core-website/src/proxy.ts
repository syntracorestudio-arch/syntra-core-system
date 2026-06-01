import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/panel-session";

/**
 * Gate del panel interno (convención `proxy` de Next 16, ex `middleware`).
 *
 * Protege /panel/* server-side: sin cookie de sesión válida (firma + no
 * expirada), redirige a /panel/login. Corre antes de renderizar cualquier
 * página → la protección NO depende de la UI. /panel/login queda excluido.
 */
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // El login es público; todo lo demás de /panel requiere sesión.
  if (pathname === "/panel/login") {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const valid = await verifySessionToken(token, process.env.PANEL_SESSION_SECRET);

  if (!valid) {
    const url = req.nextUrl.clone();
    url.pathname = "/panel/login";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/panel", "/panel/:path*"],
};
