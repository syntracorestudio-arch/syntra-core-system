"use server";

import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";

function back(params: Record<string, string>): never {
  redirect(`/cuenta?${new URLSearchParams(params).toString()}`);
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
