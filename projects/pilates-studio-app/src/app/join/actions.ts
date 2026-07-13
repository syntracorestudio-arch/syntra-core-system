"use server";

import { createHash } from "node:crypto";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServer } from "@/lib/supabase/server";

const joinError = (msg: string): never =>
  redirect("/join?error=" + encodeURIComponent(msg));

/** Hash sha256 del código normalizado (upper + trim) — debe coincidir con el guardado. */
function hashCode(code: string): string {
  return createHash("sha256").update(code.trim().toUpperCase()).digest("hex");
}

/**
 * Alta de alumno por código de estudio.
 * Valida el código → crea el usuario (service_role, server-only) → lo vincula como
 * 'client' vía RPC atómica → inicia sesión → /app. El service_role NUNCA va al browser.
 */
export async function join(formData: FormData) {
  const fullName = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const code = String(formData.get("code") ?? "").trim();

  if (!fullName || !email || !password || !code) {
    joinError("Completá todos los campos.");
  }
  if (password.length < 8) {
    joinError("La contraseña debe tener al menos 8 caracteres.");
  }

  const admin = createAdminClient();

  // 1. Pre-validar el código (sin crear usuario si es inválido) — error genérico.
  const { data: codeRow } = await admin
    .from("studio_join_codes")
    .select("id, is_active, max_uses, uses_count, expires_at")
    .eq("code_hash", hashCode(code))
    .maybeSingle();

  const invalid =
    !codeRow ||
    !codeRow.is_active ||
    (codeRow.expires_at && new Date(codeRow.expires_at) <= new Date()) ||
    (codeRow.max_uses != null && codeRow.uses_count >= codeRow.max_uses);

  if (invalid) {
    joinError("Código inválido o no disponible.");
  }

  // 2. Crear el usuario (Auth admin; email confirmado para poder loguear).
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  const user = created?.user;
  if (createErr || !user) {
    return joinError("No se pudo crear la cuenta (¿el email ya está registrado?).");
  }
  const userId = user.id;

  // 3. Canjear el código → vincular como 'client' (atómico). Si falla, limpiar el usuario.
  const { error: redeemErr } = await admin.rpc("redeem_join_code", {
    p_code: code,
    p_profile_id: userId,
  });
  if (redeemErr) {
    await admin.auth.admin.deleteUser(userId);
    joinError("Código inválido o no disponible.");
  }

  // 4. Iniciar sesión (anon + cookies SSR) y entrar.
  const supabase = await createSupabaseServer();
  const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
  if (signInErr) {
    redirect("/login");
  }

  redirect("/app");
}

/**
 * Vincula una cuenta YA logueada (ej. entró con Google) a un estudio por código.
 * Usa la RPC atómica con el cliente del usuario (grant a authenticated) — sin service-role.
 */
export async function linkWithCode(formData: FormData) {
  const code = String(formData.get("code") ?? "").trim();
  if (!code) joinError("Ingresá el código de tu estudio.");

  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.rpc("redeem_join_code", {
    p_code: code,
    p_profile_id: user.id,
  });
  if (error) joinError("Código inválido o no disponible.");

  redirect("/app?notice=" + encodeURIComponent("¡Listo! Tu cuenta quedó vinculada al estudio."));
}
