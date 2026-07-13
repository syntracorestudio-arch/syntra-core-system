"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";

/** Server Action de login con email + password (Supabase Auth, anon + cookies). */
export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    redirect("/login?error=" + encodeURIComponent("Completá email y contraseña."));
  }

  const supabase = await createSupabaseServer();
  const { data: signIn, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !signIn.user) {
    // No filtrar detalles del error de auth.
    redirect("/login?error=" + encodeURIComponent("Credenciales inválidas."));
  }

  // Superadmin (SYNTRA) → panel global de estudios.
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_superadmin")
    .eq("id", signIn.user.id)
    .maybeSingle();
  if (profile?.is_superadmin) redirect("/super");

  // Ruteo por rol: cada perfil aterriza donde le sirve. IMPORTANTE filtrar por el
  // usuario actual: admin/reception ven TODOS los members del estudio (RLS), así que
  // sin este filtro `.limit(1)` devolvería un member arbitrario. Fallback → /app.
  const { data: member } = await supabase
    .from("members")
    .select("role")
    .eq("profile_id", signIn.user.id)
    .limit(1)
    .maybeSingle();
  const role = member?.role;
  if (role === "instructor") redirect("/instructor");
  if (role === "admin" || role === "reception") redirect("/admin");
  redirect("/app");
}

/** Inicia el flujo OAuth de Google (PKCE): redirige a Google y vuelve por /auth/callback. */
export async function loginWithGoogle() {
  const supabase = await createSupabaseServer();
  const h = await headers();
  const host = h.get("host") ?? "localhost:3001";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${proto}://${host}/auth/callback` },
  });
  if (error || !data?.url) {
    redirect("/login?error=" + encodeURIComponent("No se pudo iniciar sesión con Google. Reintentá."));
  }
  redirect(data.url);
}
