"use server";

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
