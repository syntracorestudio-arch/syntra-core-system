"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase/server";

/** El alumno define su meta de clases por mes (RPC 030: solo toca monthly_goal propio). */
export async function setMonthlyGoal(formData: FormData) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const raw = String(formData.get("goal") ?? "").trim();
  const goal = raw === "" ? null : Number(raw);
  if (goal !== null && (!Number.isInteger(goal) || goal < 1 || goal > 60)) {
    redirect("/app/entrenamiento?error=" + encodeURIComponent("La meta debe ser un número entre 1 y 60."));
  }

  const { error } = await supabase.rpc("set_monthly_goal", { p_goal: goal });
  if (error) redirect("/app/entrenamiento?error=" + encodeURIComponent("No se pudo guardar tu meta."));

  revalidatePath("/app/entrenamiento");
  redirect("/app/entrenamiento?notice=" + encodeURIComponent(goal ? "Meta guardada. ¡A por esas clases!" : "Meta quitada."));
}
