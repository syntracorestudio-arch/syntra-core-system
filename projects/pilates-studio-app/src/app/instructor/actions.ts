"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
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
  const back = (params: Record<string, string> = {}): never => {
    // el pulso del sidebar (próxima clase + sin cerrar) vive en el layout
    revalidatePath("/instructor", "layout");
    redirect(`/instructor?${new URLSearchParams({ occ, ...params }).toString()}`);
  };

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

/**
 * Marca PRESENTES a todos los anotados sin marca de la ocurrencia (los ya marcados
 * no se tocan — después se ajustan las excepciones una por una). Reutiliza la RPC
 * set_attendance por reserva: misma autorización y reglas (clase propia + empezada).
 */
export async function markAllPresent(formData: FormData) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const occ = String(formData.get("occ") ?? "");
  const back = (params: Record<string, string> = {}): never => {
    // el pulso del sidebar (próxima clase + sin cerrar) vive en el layout
    revalidatePath("/instructor", "layout");
    redirect(`/instructor?${new URLSearchParams({ occ, ...params }).toString()}`);
  };

  const { data: rows, error: rosterError } = await supabase.rpc("instructor_class_roster", {
    p_occurrence_id: occ,
  });
  if (rosterError) return back({ error: "No se pudo cargar la clase." });

  const pending = ((rows ?? []) as { reservation_id: string; attendance_status: string | null }[]).filter(
    (r) => !r.attendance_status,
  );
  for (const r of pending) {
    const { error } = await supabase.rpc("set_attendance", {
      p_reservation_id: r.reservation_id,
      p_status: "checked_in",
    });
    if (error) {
      const msg = error.message.includes("class_not_started")
        ? "La clase todavía no empezó."
        : "No se pudo marcar a todos. Revisá la lista.";
      return back({ error: msg });
    }
  }
  back({ notice: pending.length > 0 ? `${pending.length} marcados presentes.` : "No había nadie sin marcar." });
}

/**
 * Nota PRIVADA del instructor sobre un alumno (campo propio, separado de la nota
 * operativa del admin). Upsert directo: la RLS de instructor_notes garantiza que
 * solo escribe sobre su propio instructor_member_id y su estudio.
 */
export async function saveInstructorNote(formData: FormData) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const occ = String(formData.get("occ") ?? "");
  const memberId = String(formData.get("member") ?? "");
  const note = String(formData.get("note") ?? "").trim().slice(0, 500);
  const back = (params: Record<string, string> = {}): never => {
    // el pulso del sidebar (próxima clase + sin cerrar) vive en el layout
    revalidatePath("/instructor", "layout");
    redirect(`/instructor?${new URLSearchParams({ occ, ...params }).toString()}`);
  };

  const { error } = await supabase.rpc("save_instructor_note", {
    p_member_id: memberId,
    p_note: note,
  });
  if (error) {
    const msg = error.message.includes("forbidden") ? "No autorizado." : "No se pudo guardar la nota.";
    return back({ error: msg });
  }
  back({ notice: note === "" ? "Nota borrada." : "Nota guardada." });
}

/**
 * Aviso de imprevisto sobre una clase futura PROPIA → notificación in-app al panel
 * (admin/recepción). Validación real en la RPC instructor_report_issue (025).
 */
export async function reportIssue(formData: FormData) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const occ = String(formData.get("occ") ?? "");
  const message = String(formData.get("message") ?? "").trim();
  const back = (params: Record<string, string> = {}): never => {
    // el pulso del sidebar (próxima clase + sin cerrar) vive en el layout
    revalidatePath("/instructor", "layout");
    redirect(`/instructor?${new URLSearchParams({ occ, ...params }).toString()}`);
  };

  if (message === "") return back({ error: "Contanos qué pasó para avisarle al estudio." });

  const { error } = await supabase.rpc("instructor_report_issue", {
    p_occurrence_id: occ,
    p_message: message,
  });
  if (error) {
    const msg = error.message.includes("not_reportable")
      ? "Esta clase ya empezó o no está programada."
      : error.message.includes("forbidden")
        ? "No autorizado."
        : "No se pudo enviar el aviso.";
    return back({ error: msg });
  }
  back({ notice: "Aviso enviado al estudio." });
}
