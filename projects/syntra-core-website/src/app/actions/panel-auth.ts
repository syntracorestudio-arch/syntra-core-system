"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  createSessionToken,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
} from "@/lib/auth/panel-session";
import { rateLimit } from "@/lib/rate-limit";
import type { PanelLoginState } from "@/app/actions/panel-auth-state";

/** Comparación en tiempo constante del passcode. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** IP del cliente desde headers de proxy (Vercel/Cloudflare). */
async function getClientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || h.get("x-real-ip") || "unknown";
}

/**
 * Login del panel — firma compatible con useActionState.
 * Verifica passcode en el SERVIDOR, setea cookie httpOnly firmada y redirige.
 */
export async function panelLogin(
  _prev: PanelLoginState,
  formData: FormData,
): Promise<PanelLoginState> {
  // Rate limit por IP ANTES de validar el passcode (anti fuerza bruta).
  // Bucket propio "login:" (independiente del de captación de leads).
  const ip = await getClientIp();
  const rl = rateLimit(`login:${ip}`); // defaults: 5 intentos / 10 min
  if (!rl.ok) {
    return {
      error: `Demasiados intentos. Probá de nuevo en ${rl.retryAfterSec} segundos.`,
    };
  }

  const passcode = String(formData.get("passcode") ?? "");
  const expected = process.env.PANEL_PASSWORD;
  const secret = process.env.PANEL_SESSION_SECRET;

  if (!expected || !secret) {
    return {
      error: "El panel no está configurado (faltan variables de entorno).",
    };
  }

  if (!passcode || !safeEqual(passcode, expected)) {
    return { error: "Passcode incorrecto." };
  }

  const token = await createSessionToken(secret);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/panel",
    maxAge: SESSION_TTL_SECONDS,
  });

  redirect("/panel");
}

/** Cierra sesión: borra la cookie y vuelve al login. */
export async function panelLogout(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  redirect("/panel/login");
}
