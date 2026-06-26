"use server";

import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";

function back(day: string, params: Record<string, string>): never {
  const qs = new URLSearchParams({ day, ...params });
  redirect(`/app?${qs.toString()}`);
}

/** Mapea el error de la RPC a un mensaje claro para el alumno (sin filtrar internals). */
function messageFor(raw: string): { kind: "error" | "notice"; text: string } {
  if (raw.includes("no_capacity"))
    return { kind: "error", text: "Se llenó recién. Probá sumarte a la lista de espera." };
  if (raw.includes("no_credit"))
    return { kind: "error", text: "No tenés crédito ni membresía activa para reservar." };
  if (raw.includes("blocked_debt"))
    return { kind: "error", text: "Tenés un pago pendiente. Hablá con tu estudio." };
  if (raw.includes("already_booked"))
    return { kind: "error", text: "Ya tenés esta clase reservada." };
  if (raw.includes("already_waiting"))
    return { kind: "error", text: "Ya estás en la lista de espera de esta clase." };
  if (raw.includes("class_closed"))
    return { kind: "error", text: "Esta clase ya no admite cambios." };
  return { kind: "error", text: "No se pudo completar la acción. Probá de nuevo." };
}

export async function reserve(formData: FormData) {
  const day = String(formData.get("day") ?? "");
  const occ = String(formData.get("occ") ?? "");
  const supabase = await createSupabaseServer();
  const { error } = await supabase.rpc("reserve_class", { p_occurrence_id: occ });
  if (error) {
    const m = messageFor(error.message);
    back(day, { [m.kind]: m.text });
  }
  back(day, { notice: "Reserva confirmada." });
}

export async function joinWaitlist(formData: FormData) {
  const day = String(formData.get("day") ?? "");
  const occ = String(formData.get("occ") ?? "");
  const supabase = await createSupabaseServer();
  const { error } = await supabase.rpc("join_waitlist", { p_occurrence_id: occ });
  if (error) {
    const m = messageFor(error.message);
    back(day, { [m.kind]: m.text });
  }
  back(day, { notice: "Te sumaste a la lista de espera." });
}

export async function cancelReservation(formData: FormData) {
  const day = String(formData.get("day") ?? "");
  const res = String(formData.get("res") ?? "");
  const supabase = await createSupabaseServer();
  const { error } = await supabase.rpc("cancel_reservation", { p_reservation_id: res });
  if (error) {
    back(day, { error: "No se pudo cancelar. Probá de nuevo." });
  }
  back(day, { notice: "Reserva cancelada." });
}
