"use server";

import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";

/** Asistencia desde la vista Hoy (admin/recepción) — misma RPC 020, vuelve a /admin/hoy. */
export async function setTodayAttendance(formData: FormData) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const value = String(formData.get("value") ?? "");
  const back = (params: Record<string, string> = {}): never =>
    redirect(`/admin/hoy?${new URLSearchParams(params).toString()}`);
  if (!["checked_in", "no_show", "clear"].includes(value)) back({ error: "Acción inválida." });

  const { error } = await supabase.rpc("set_attendance", {
    p_reservation_id: String(formData.get("reservation") ?? ""),
    p_status: value,
  });
  back(
    error
      ? { error: error.message.includes("class_not_started") ? "La clase todavía no empezó." : "No se pudo guardar la asistencia." }
      : {},
  );
}
