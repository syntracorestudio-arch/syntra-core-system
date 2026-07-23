"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  createSessionToken,
  SESSION_COOKIE,
  SESSION_COOKIE_PATH,
  SESSION_TTL_SECONDS,
} from "@/lib/auth/panel-session";
import { rateLimit } from "@/lib/rate-limit";
import type { PanelLoginState } from "@/app/actions/panel-auth-state";

/** Comparación en tiempo constante (opera sobre digests de igual longitud). */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * SHA-256 en hex. Se compara el DIGEST del passcode contra el del esperado
 * (siempre 64 chars) en vez de los valores crudos: así ni el largo real del
 * passcode se filtra por timing (el corte por longitud de `safeEqual` nunca
 * depende del secreto).
 */
async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** IP del cliente desde headers de proxy (Vercel/Cloudflare). */
async function getClientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || h.get("x-real-ip") || "unknown";
}

/**
 * Destino post-login. Sólo rutas internas del panel (nunca el propio login),
 * validando contra open-redirect: debe empezar con `/panel/` (o ser `/panel`)
 * y no contener `//`, `\` ni `..`. Cualquier otra cosa cae a `/panel`.
 */
function safeReturnPath(raw: FormDataEntryValue | null): string {
  const from = typeof raw === "string" ? raw : "";
  if (from !== "/panel" && !from.startsWith("/panel/")) return "/panel";
  if (from.startsWith("/panel/login")) return "/panel";
  if (from.includes("//") || from.includes("\\") || from.includes("..")) {
    return "/panel";
  }
  return from;
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

  const [passcodeHash, expectedHash] = await Promise.all([
    sha256Hex(passcode),
    sha256Hex(expected),
  ]);
  if (!passcode || !safeEqual(passcodeHash, expectedHash)) {
    return { error: "Passcode incorrecto." };
  }

  const token = await createSessionToken(secret);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: SESSION_COOKIE_PATH,
    maxAge: SESSION_TTL_SECONDS,
  });

  // Vuelve a la ruta que disparó el gate (?from=), validada; si no, al panel.
  redirect(safeReturnPath(formData.get("from")));
}

/**
 * Cierra sesión: expira la cookie y vuelve al login. Se sobreescribe con
 * `maxAge: 0` usando EL MISMO path que al setearla — un `delete(name)` a secas
 * borra con path `/` y dejaría viva la cookie de `path=/panel` (la sesión no se
 * cerraría). Mismas flags que el set para que el browser haga match y la elimine.
 */
export async function panelLogout(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: SESSION_COOKIE_PATH,
    maxAge: 0,
  });
  redirect("/panel/login");
}
