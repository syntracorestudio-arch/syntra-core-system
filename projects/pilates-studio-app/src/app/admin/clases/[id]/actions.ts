"use server";

import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";

const ADMIN_ROLES = ["admin", "reception"];

function backTo(classId: string, occ: string, params: Record<string, string>): never {
  const qs = new URLSearchParams({ ...(occ ? { occ } : {}), ...params });
  redirect(`/admin/clases/${classId}?${qs.toString()}`);
}

async function guard() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: member } = await supabase
    .from("members")
    .select("role")
    .eq("profile_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!member || !ADMIN_ROLES.includes(member.role)) redirect("/app");
  return supabase;
}

export async function promoteWaitlist(formData: FormData) {
  const supabase = await guard();
  const classId = String(formData.get("classId") ?? "");
  const occ = String(formData.get("occ") ?? "");
  const { error } = await supabase.rpc("promote_from_waitlist", {
    p_waitlist_id: String(formData.get("waitlist") ?? ""),
  });
  if (error) {
    const msg = error.message.includes("no_capacity")
      ? "La clase está llena."
      : error.message.includes("no_credit")
        ? "El alumno no tiene créditos ni abono."
        : error.message.includes("already_booked")
          ? "El alumno ya tenía reserva."
          : "No se pudo promover.";
    backTo(classId, occ, { error: msg });
  }
  backTo(classId, occ, { notice: "Alumno promovido a la clase." });
}

export async function removeReservation(formData: FormData) {
  const supabase = await guard();
  const classId = String(formData.get("classId") ?? "");
  const occ = String(formData.get("occ") ?? "");
  const { error } = await supabase.rpc("cancel_reservation", {
    p_reservation_id: String(formData.get("reservation") ?? ""),
  });
  backTo(classId, occ, error ? { error: "No se pudo quitar la reserva." } : { notice: "Reserva cancelada." });
}

export async function cancelOccurrenceDetail(formData: FormData) {
  const supabase = await guard();
  const classId = String(formData.get("classId") ?? "");
  const { error } = await supabase.rpc("cancel_class_occurrence", {
    p_occurrence_id: String(formData.get("occ") ?? ""),
  });
  backTo(classId, "", error ? { error: "No se pudo cancelar la clase." } : { notice: "Clase cancelada." });
}
