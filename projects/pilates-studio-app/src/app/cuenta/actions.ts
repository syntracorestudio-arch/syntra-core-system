"use server";

import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";

function back(params: Record<string, string>): never {
  redirect(`/cuenta?${new URLSearchParams(params).toString()}`);
}

/** Actualiza nombre y teléfono del perfil propio (RLS: profiles_update_own). */
export async function updateProfile(formData: FormData) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const fullName = String(formData.get("full_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  if (fullName.length < 2 || fullName.length > 80) {
    back({ error: "Ingresá tu nombre (2 a 80 caracteres)." });
  }
  if (phone && !/^[+\d][\d\s-]{5,19}$/.test(phone)) {
    back({ error: "El teléfono no parece válido. Usá solo números, espacios o guiones." });
  }

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName, phone: phone || null })
    .eq("id", user.id);
  if (error) back({ error: "No se pudieron guardar tus datos. Reintentá." });
  back({ notice: "Datos actualizados." });
}

/** Cambia la contraseña del usuario logueado (cualquier rol). */
export async function changePassword(formData: FormData) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 8) back({ error: "La contraseña nueva debe tener al menos 8 caracteres." });
  if (password !== confirm) back({ error: "Las contraseñas no coinciden." });

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    back({
      error:
        error.code === "same_password"
          ? "La contraseña nueva es igual a la actual."
          : "No se pudo cambiar la contraseña. Reintentá.",
    });
  }
  back({ notice: "Contraseña actualizada." });
}
