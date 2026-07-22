"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { headers } from "next/headers";
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

  // Freno anti fuerza-bruta por IP. Fail-open: si el limiter se cae, no dejamos
  // a nadie afuera de su propio negocio.
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const allowed = await checkRateLimit(`login:${ip}`, 10, 300);
  if (!allowed) {
    return { error: "Demasiados intentos. Esperá un minuto y probá de nuevo." };
  }

  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return { error: "Email o contraseña incorrectos." };
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
