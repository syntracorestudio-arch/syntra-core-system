import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Fecha ICS en UTC: YYYYMMDDTHHMMSSZ */
function icsDate(iso: string) {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}
function icsEscape(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

/**
 * Descarga .ics de una clase para el calendario del teléfono. Solo si el alumno
 * tiene RESERVA activa en esa ocurrencia (RLS: sus reservas; la ocurrencia, de su estudio).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", _req.url));

  const [{ data: res }, { data: occ }] = await Promise.all([
    supabase.from("class_reservations").select("id").eq("occurrence_id", id).eq("status", "booked").limit(1).maybeSingle(),
    supabase
      .from("class_occurrences")
      .select("starts_at, ends_at, classes(name, instructor_name), studios(name)")
      .eq("id", id)
      .maybeSingle(),
  ]);
  if (!res || !occ) return new NextResponse("No encontrado", { status: 404 });

  const cls = (Array.isArray(occ.classes) ? occ.classes[0] : occ.classes) as
    | { name: string; instructor_name: string | null }
    | null;
  const studio = (Array.isArray(occ.studios) ? occ.studios[0] : occ.studios) as { name: string } | null;
  const title = `${cls?.name ?? "Clase"} · ${studio?.name ?? "Estudio"}`;
  const desc = cls?.instructor_name ? `Con ${cls.instructor_name}.` : "";

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//StudioFlow//ES",
    "BEGIN:VEVENT",
    `UID:studioflow-${id}@studioflow`,
    `DTSTAMP:${icsDate(new Date().toISOString())}`,
    `DTSTART:${icsDate(occ.starts_at as string)}`,
    `DTEND:${icsDate(occ.ends_at as string)}`,
    `SUMMARY:${icsEscape(title)}`,
    desc ? `DESCRIPTION:${icsEscape(desc)}` : null,
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="clase.ics"`,
    },
  });
}
