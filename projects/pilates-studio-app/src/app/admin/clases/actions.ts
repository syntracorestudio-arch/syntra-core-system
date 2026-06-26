"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";

const ADMIN_ROLES = ["admin", "reception"];

function back(params: Record<string, string>): never {
  redirect(`/admin/clases?${new URLSearchParams(params).toString()}`);
}

/** Hora local del estudio (YYYY-MM-DD + HH:MM en tz IANA) → instante UTC ISO (DST-safe). */
function localToUtcISO(dateStr: string, timeStr: string, tz: string): string {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const [h, mi] = timeStr.split(":").map(Number);
  const asUTC = Date.UTC(y, mo - 1, d, h, mi);
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const p = Object.fromEntries(dtf.formatToParts(new Date(asUTC)).map((x) => [x.type, x.value]));
  const tzAsUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
  const offset = tzAsUTC - asUTC; // ms que la tz está adelantada respecto a UTC en ese horario
  return new Date(asUTC - offset).toISOString();
}

const Common = z.object({
  name: z.string().trim().min(1).max(80),
  instructor: z.string().trim().max(80).optional().default(""),
  capacity: z.coerce.number().int().positive().max(200),
  duration: z.coerce.number().int().min(10).max(240),
});

export async function createClass(formData: FormData) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // estudio + rol + tz del actor (RLS: ve su propio member)
  const { data: member } = await supabase
    .from("members")
    .select("role, studio_id, studios(timezone)")
    .limit(1)
    .maybeSingle();
  const studioRel = member?.studios as { timezone: string | null } | { timezone: string | null }[] | null;
  const studio = Array.isArray(studioRel) ? studioRel[0] : studioRel;
  const tz = studio?.timezone || "America/Argentina/Buenos_Aires";
  if (!member || !ADMIN_ROLES.includes(member.role)) back({ error: "No autorizado." });

  const type = String(formData.get("type") ?? "once");
  const common = Common.safeParse({
    name: formData.get("name"),
    instructor: formData.get("instructor"),
    capacity: formData.get("capacity"),
    duration: formData.get("duration"),
  });
  if (!common.success) back({ error: "Revisá los datos del formulario." });
  const c = common.data;

  // 1) crear la clase (plantilla)
  const { data: klass, error: classErr } = await supabase
    .from("classes")
    .insert({
      studio_id: member!.studio_id,
      name: c.name,
      type: String(formData.get("ctype") ?? "") || null,
      default_capacity: c.capacity,
      duration_min: c.duration,
      instructor_name: c.instructor || null,
    })
    .select("id")
    .single();
  if (classErr || !klass) back({ error: "No se pudo crear la clase." });
  const classId = klass.id as string;

  if (type === "once") {
    const date = String(formData.get("date") ?? "");
    const time = String(formData.get("time") ?? "");
    if (!date || !time) back({ error: "Indicá fecha y hora." });
    const startsIso = localToUtcISO(date, time, tz);
    if (new Date(startsIso) <= new Date()) back({ error: "La fecha/hora ya pasó." });
    const ends = new Date(new Date(startsIso).getTime() + c.duration * 60_000).toISOString();
    const { error } = await supabase.from("class_occurrences").insert({
      studio_id: member!.studio_id,
      class_id: classId,
      schedule_id: null,
      starts_at: startsIso,
      ends_at: ends,
      capacity: c.capacity,
      booked_count: 0,
      status: "scheduled",
    });
    if (error) back({ error: "No se pudo crear la ocurrencia." });
    back({ notice: "Clase única creada." });
  }

  // recurrente
  const days = formData.getAll("days").map((d) => Number(d)).filter((n) => n >= 0 && n <= 6);
  const time = String(formData.get("time") ?? "");
  const validFrom = String(formData.get("valid_from") ?? "");
  const validTo = String(formData.get("valid_to") ?? "") || null;
  if (days.length === 0 || !time || !validFrom) back({ error: "Elegí días, hora y fecha de inicio." });

  let total = 0;
  for (const weekday of days) {
    const { data: sch, error: schErr } = await supabase
      .from("class_schedules")
      .insert({
        studio_id: member!.studio_id,
        class_id: classId,
        weekday,
        start_time: time,
        capacity: c.capacity,
        valid_from: validFrom,
        valid_to: validTo,
      })
      .select("id")
      .single();
    if (schErr || !sch) back({ error: "No se pudo crear la regla recurrente." });
    const { data: count } = await supabase.rpc("materialize_schedule", {
      p_schedule_id: sch.id,
      p_weeks: 8,
    });
    total += Number(count ?? 0);
  }
  back({ notice: `Clase recurrente creada · ${total} clases generadas.` });
}

export async function cancelOccurrence(formData: FormData) {
  const supabase = await createSupabaseServer();
  const { error } = await supabase.rpc("cancel_class_occurrence", {
    p_occurrence_id: String(formData.get("occ") ?? ""),
  });
  back(error ? { error: "No se pudo cancelar la clase." } : { notice: "Clase cancelada." });
}

export async function cancelClass(formData: FormData) {
  const supabase = await createSupabaseServer();
  const { error } = await supabase.rpc("cancel_class", {
    p_class_id: String(formData.get("class") ?? ""),
  });
  back(error ? { error: "No se pudo archivar la clase." } : { notice: "Clase archivada." });
}
