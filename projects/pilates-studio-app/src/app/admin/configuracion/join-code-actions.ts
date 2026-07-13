"use server";

import { createHash, randomInt } from "node:crypto";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";

function back(params: Record<string, string>): never {
  redirect(`/admin/configuracion?${new URLSearchParams(params).toString()}#codigo-alta`);
}

/** Alfabeto legible (sin 0/O/1/I/L) para códigos que se dictan por teléfono o WhatsApp. */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function newCode(len = 8) {
  let s = "";
  for (let i = 0; i < len; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return s;
}

function hashCode(code: string): string {
  return createHash("sha256").update(code.trim().toUpperCase()).digest("hex");
}

/** Solo admin gestiona el código de alta (misma regla que el resto de Configuración). */
async function adminStudio() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: member } = await supabase
    .from("members")
    .select("role, studio_id")
    .eq("profile_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!member || member.role !== "admin") redirect("/admin");
  return { supabase, studioId: member.studio_id as string };
}

/**
 * Genera un código de alta nuevo (desactiva el anterior). Se guarda SOLO el hash;
 * el texto plano se muestra UNA vez en la pantalla (patrón API-key). RLS: la política
 * join_codes_admin permite gestionarlos con el cliente del propio admin.
 */
export async function generateJoinCode() {
  const { supabase, studioId } = await adminStudio();

  const code = newCode();
  const { error: offErr } = await supabase
    .from("studio_join_codes")
    .update({ is_active: false })
    .eq("studio_id", studioId)
    .eq("is_active", true);
  if (offErr) back({ error: "No se pudo regenerar el código. Reintentá." });

  const { error } = await supabase.from("studio_join_codes").insert({
    studio_id: studioId,
    code_hash: hashCode(code),
    label: "alta de alumnos",
    is_active: true,
  });
  if (error) back({ error: "No se pudo generar el código. Reintentá." });

  back({ newCode: code, notice: "Código generado. Guardalo: no se vuelve a mostrar." });
}

/** Desactiva el código vigente (nadie más puede sumarse hasta generar otro). */
export async function deactivateJoinCode() {
  const { supabase, studioId } = await adminStudio();
  const { error } = await supabase
    .from("studio_join_codes")
    .update({ is_active: false })
    .eq("studio_id", studioId)
    .eq("is_active", true);
  back(
    error
      ? { error: "No se pudo desactivar el código." }
      : { notice: "Código desactivado. Generá uno nuevo cuando quieras." },
  );
}
