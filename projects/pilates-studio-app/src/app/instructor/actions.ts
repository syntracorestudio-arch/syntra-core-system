"use server";

import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";

/**
 * Asistencia del instructor: presente / faltó / limpiar, vía RPC set_attendance
 * (SECURITY DEFINER, migración 020) que valida que la clase sea SUYA y ya haya
 * empezado, y escribe attendance + estado de la reserva (attended/no_show) juntos.
 */
export async function setAttendance(formData: FormData) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const reservationId = String(formData.get("reservation") ?? "");
  const occ = String(formData.get("occ") ?? "");
  const value = String(formData.get("value") ?? "");
  const back = (params: Record<string, string> = {}): never =>
    redirect(`/instructor?${new URLSearchParams({ occ, ...params }).toString()}`);

  if (!["checked_in", "no_show", "clear"].includes(value)) return back({ error: "Acción inválida." });

  const { error } = await supabase.rpc("set_attendance", {
    p_reservation_id: reservationId,
    p_status: value,
  });
  if (error) {
    const msg = error.message.includes("class_not_started")
      ? "La clase todavía no empezó."
      : error.message.includes("not_authorized")
        ? "No autorizado."
        : "No se pudo guardar la asistencia.";
    return back({ error: msg });
  }
  back();
}
