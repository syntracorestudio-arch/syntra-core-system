"use server";

import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";

/**
 * Check-in del instructor: marca/desmarca "presente" (tabla attendance).
 * El instructor NO puede tocar class_reservations (RLS), pero SÍ attendance.
 * Valida que la reserva pertenezca a una clase SUYA (instructor_id = su member id).
 * value: "checked_in" → upsert presente · "clear" → borra la marca.
 */
export async function setAttendance(formData: FormData) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("members")
    .select("id, role")
    .eq("profile_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!me || me.role !== "instructor") redirect("/app");

  const reservationId = String(formData.get("reservation") ?? "");
  const occ = String(formData.get("occ") ?? "");
  const value = String(formData.get("value") ?? "");
  const back = (params: Record<string, string> = {}): never =>
    redirect(`/instructor?${new URLSearchParams({ occ, ...params }).toString()}`);

  // la reserva debe pertenecer a una clase de este instructor
  const { data: r } = await supabase
    .from("class_reservations")
    .select("id, studio_id, class_occurrences(classes(instructor_id))")
    .eq("id", reservationId)
    .maybeSingle();
  if (!r) return back({ error: "Reserva no encontrada." });

  const occRel = Array.isArray(r.class_occurrences) ? r.class_occurrences[0] : r.class_occurrences;
  const clsRel = occRel ? (Array.isArray(occRel.classes) ? occRel.classes[0] : occRel.classes) : null;
  if (!clsRel || clsRel.instructor_id !== me.id) return back({ error: "No autorizado." });

  if (value === "clear") {
    await supabase.from("attendance").delete().eq("reservation_id", reservationId);
  } else {
    await supabase.from("attendance").upsert(
      {
        reservation_id: reservationId,
        studio_id: r.studio_id as string,
        status: "checked_in",
        checked_in_at: new Date().toISOString(),
      },
      { onConflict: "reservation_id" },
    );
  }
  back();
}
