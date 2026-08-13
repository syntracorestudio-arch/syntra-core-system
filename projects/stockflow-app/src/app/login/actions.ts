"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { headers } from "next/headers";
import { createHash } from "node:crypto";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";

const schema = z.object({
  email: z.string().email("Revisá el email."),
  password: z.string().min(1, "Escribí tu contraseña."),
});

export type LoginState = { error?: string };

/**
 * Login. Endpoint público → pasa por rate limit (baseline
 * `syntra-scale-security-baseline`), valida server-side y devuelve un error
 * GENÉRICO: nunca revela si el email existe.
 */
export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisá los datos." };
  }

  /* Freno anti fuerza-bruta en DOS ejes. Fail-open: si el limiter se cae, no
     dejamos a nadie afuera de su propio negocio.

     049 · el freno por cuenta es el que importa y no existía: un kiosco entero
     sale por UNA sola IP, así que el cupo compartido lo consumían tres
     empleados equivocándose, mientras que un atacante con muchas IPs no tenía
     ningún techo sobre una cuenta puntual. Por eso el de IP se afloja (30) y
     el freno real pasa a la cuenta (5 / 15 min).

     La clave se hashea: `rate_limits` es una tabla y no tiene por qué guardar
     el email de nadie en claro. */
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const cuenta = createHash("sha256").update(parsed.data.email.toLowerCase()).digest("hex");

  const [ipOk, cuentaOk] = await Promise.all([
    checkRateLimit(`login:ip:${ip}`, 30, 300),
    checkRateLimit(`login:acct:${cuenta}`, 5, 900),
  ]);
  if (!ipOk || !cuentaOk) {
    return { error: "Demasiados intentos. Esperá unos minutos y probá de nuevo." };
  }

  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    // Degradar con honestidad: "credenciales malas" solo cuando GoTrue lo dijo
    // (400). Cualquier otra cosa (Supabase local apagado, red caída, 5xx) es un
    // problema NUESTRO y decirle "contraseña incorrecta" al dueño lo manda a
    // pelearse con su clave — pasó el 2026-07-23 con Docker cerrado.
    if (error.status === 400) {
      return { error: "Email o contraseña incorrectos." };
    }
    return {
      error: "No pudimos conectar con el sistema. Esperá un momento y probá de nuevo.",
    };
  }

  redirect("/");
}

export async function signOut() {
  const supabase = await createSupabaseServer();
  await supabase.auth.signOut();
  redirect("/login");
}

/**
 * Ruteo por rol después del login. Vive server-side y no en el cliente para que
 * nadie pueda "elegir" a qué panel entra.
 */
export async function roleHome(profileId: string): Promise<string> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("members")
    .select("role")
    .eq("profile_id", profileId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  return data?.role === "owner" ? "/admin" : "/pos";
}
