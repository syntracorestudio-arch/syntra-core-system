"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase/server";

/** Vuelve a la página de origen (`from`, p. ej. /app/actividad) o a /app?day=… */
function back(day: string, params: Record<string, string>, from?: string): never {
  // el saldo/novedades del sidebar viven en el LAYOUT → no se re-renderiza en
  // navegación suave sin esto (mismo fix que /admin)
  revalidatePath("/app", "layout");
  if (from && from.startsWith("/app")) {
    const qs = new URLSearchParams(params);
    redirect(`${from}?${qs.toString()}`);
  }
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

/** Estudio suspendido (Fase 5) → sin reservas nuevas (cancelar SÍ se permite). */
async function studioIsSuspended(supabase: Awaited<ReturnType<typeof createSupabaseServer>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase
    .from("members")
    .select("studios(status)")
    .eq("profile_id", user.id)
    .limit(1)
    .maybeSingle();
  const rel = (data?.studios ?? null) as { status: string } | { status: string }[] | null;
  return (Array.isArray(rel) ? rel[0] : rel)?.status === "suspended";
}

export async function reserve(formData: FormData) {
  const day = String(formData.get("day") ?? "");
  const occ = String(formData.get("occ") ?? "");
  const supabase = await createSupabaseServer();
  if (await studioIsSuspended(supabase)) {
    back(day, { error: "El estudio está suspendido; no se pueden reservar clases." });
  }
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
  if (await studioIsSuspended(supabase)) {
    back(day, { error: "El estudio está suspendido; no se pueden reservar clases." });
  }
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
  const from = String(formData.get("from") ?? "");
  const supabase = await createSupabaseServer();
  const { error } = await supabase.rpc("cancel_reservation", { p_reservation_id: res });
  if (error) {
    back(day, { error: "No se pudo cancelar. Probá de nuevo." }, from);
  }
  back(day, { notice: "Reserva cancelada." }, from);
}

export async function leaveWaitlist(formData: FormData) {
  const day = String(formData.get("day") ?? "");
  const occ = String(formData.get("occ") ?? "");
  const from = String(formData.get("from") ?? "");
  const supabase = await createSupabaseServer();
  const { error } = await supabase.rpc("leave_waitlist", { p_occurrence_id: occ });
  if (error) {
    back(day, { error: "No se pudo salir de la lista. Probá de nuevo." }, from);
  }
  back(day, { notice: "Saliste de la lista de espera." }, from);
}

/** Marca leída una notificación propia (RLS: update_own). */
export async function markNotificationRead(formData: FormData) {
  const day = String(formData.get("day") ?? "");
  const id = String(formData.get("id") ?? "");
  const supabase = await createSupabaseServer();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
  revalidatePath("/app", "layout");
  redirect(day ? `/app?day=${day}` : "/app");
}

/** Marca leídas TODAS las notificaciones propias (campana del shell del alumno). */
export async function markMyNotificationsRead() {
  const supabase = await createSupabaseServer();
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .not("member_id", "is", null)
    .is("read_at", null);
  revalidatePath("/app", "layout");
}
