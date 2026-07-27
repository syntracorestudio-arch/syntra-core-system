import "server-only";

import { cookies } from "next/headers";

import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/panel-session";

/**
 * SYNTRA CORE — Verificación de sesión del panel DENTRO de una Server Action.
 *
 * ¿Por qué existe, si ya está el gate de `proxy.ts`?
 *
 * El proxy protege por URL (`matcher: ["/panel", "/panel/:path*"]`), pero las
 * Server Actions de Next NO se despachan por URL: se despachan por action-id
 * (header `Next-Action`) y Next las ejecuta cualquiera sea el path del POST.
 * Un POST a `/` con el action-id correcto corre la action SIN pasar por el
 * matcher y sin cookie válida. Además, si la action se importa desde un
 * componente `"use client"`, su id viaja en un chunk público de /_next/static
 * ⇒ es descubrible sin estar logueado.
 *
 * Conclusión (regla): la autorización de una Server Action se verifica DENTRO
 * de la action. El middleware/proxy es defensa en profundidad, nunca el gate
 * único de una mutación.
 */
export async function hasPanelSession(): Promise<boolean> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return verifySessionToken(token, process.env.PANEL_SESSION_SECRET);
}
