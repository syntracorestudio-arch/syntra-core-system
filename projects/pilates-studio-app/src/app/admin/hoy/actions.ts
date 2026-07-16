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

/**
 * Subir al alumno de la cola desde Hoy — RPC promote_from_waitlist (027): consume
 * crédito/valida política como una reserva normal, marca promoted (devolución hasta
 * el inicio) y le manda la notificación in-app al alumno.
 */
export async function promoteToday(formData: FormData) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const back = (params: Record<string, string> = {}): never =>
    redirect(`/admin/hoy?${new URLSearchParams(params).toString()}`);

  const { error } = await supabase.rpc("promote_from_waitlist", {
    p_waitlist_id: String(formData.get("waitlist") ?? ""),
  });
  if (error) {
    const msg = error.message.includes("no_capacity")
      ? "La clase está llena: liberá un lugar antes de subir a alguien."
      : error.message.includes("no_credit")
        ? "El alumno no tiene crédito ni abono vigente — cobrale primero."
        : error.message.includes("already_booked")
          ? "Ese alumno ya tiene reserva en esta clase."
          : error.message.includes("class_closed")
            ? "La clase ya empezó o está cerrada."
            : "No se pudo subir al alumno.";
    return back({ error: msg });
  }
  back();
}
