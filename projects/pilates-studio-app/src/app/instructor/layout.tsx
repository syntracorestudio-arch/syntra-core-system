import type { CSSProperties, ReactNode } from "react";
import { createSupabaseServer } from "@/lib/supabase/server";
import { accentForeground } from "@/lib/accent";
import { InstructorSidebar, type InstructorPulse } from "@/components/shell/instructor-sidebar";
import { SuspendedScreen } from "@/components/suspended-screen";
import { PushPrompt } from "@/components/push-prompt";

export const dynamic = "force-dynamic";

const DEFAULT_TZ = "America/Argentina/Buenos_Aires";

/**
 * Shell del INSTRUCTOR: sidebar carbón (desktop) / bottom-bar (mobile) con la marca
 * del estudio y el pulso de SU agenda (próxima clase + clases sin cerrar). Mismo
 * patrón white-label que /admin y /app. La guarda de rol la hace cada página.
 */
export default async function InstructorLayout({ children }: { children: ReactNode }) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: member } = user
    ? await supabase
        .from("members")
        .select("id, role, profiles(full_name), studios(name, branding, status, timezone)")
        .eq("profile_id", user.id)
        .limit(1)
        .maybeSingle()
    : { data: null };

  const studioRel = (member?.studios ?? null) as
    | { name: string; branding: Record<string, unknown> | null; status: string; timezone: string | null }
    | { name: string; branding: Record<string, unknown> | null; status: string; timezone: string | null }[]
    | null;
  const studio = Array.isArray(studioRel) ? studioRel[0] : studioRel;
  const studioName = studio?.name ?? "Tu estudio";

  if (studio?.status === "suspended") {
    return <SuspendedScreen studioName={studioName} audience="member" />;
  }

  const branding = studio?.branding ?? null;
  const bstr = (k: string) =>
    branding && typeof branding === "object" && typeof branding[k] === "string" ? String(branding[k]) : null;
  const accent = bstr("accent");
  const logo = bstr("logo_url");
  const style = accent
    ? ({
        "--primary": accent,
        "--ring": accent,
        "--primary-foreground": accentForeground(accent),
      } as CSSProperties)
    : undefined;

  const profRel = (member?.profiles ?? null) as { full_name: string } | { full_name: string }[] | null;
  const userName = (Array.isArray(profRel) ? profRel[0] : profRel)?.full_name ?? "Instructor";

  // ── Pulso de la agenda (solo si es instructor; queries livianas con su RLS) ──
  let pulse: InstructorPulse | null = null;
  if (user && member?.role === "instructor") {
    const tz = studio?.timezone || DEFAULT_TZ;
    const now = new Date();
    const nowIso = now.toISOString();
    const staleIso = new Date(now.getTime() - 2 * 3600_000).toISOString();
    const pastFromIso = new Date(now.getTime() - 60 * 86_400_000).toISOString();

    const [{ data: nextRaw }, { data: pastRaw }] = await Promise.all([
      supabase
        .from("class_occurrences")
        .select("starts_at, capacity, booked_count, classes!inner(name, instructor_id)")
        .eq("status", "scheduled")
        .gt("starts_at", nowIso)
        .eq("classes.instructor_id", member.id)
        .order("starts_at", { ascending: true })
        .limit(1),
      supabase
        .from("class_occurrences")
        .select("id, starts_at, classes!inner(instructor_id), class_reservations(status)")
        .eq("status", "scheduled")
        .gte("starts_at", pastFromIso)
        .lt("starts_at", staleIso)
        .eq("classes.instructor_id", member.id)
        .limit(60),
    ]);

    type Cls = { name: string };
    const next = (nextRaw ?? [])[0] as
      | { starts_at: string; capacity: number; booked_count: number; classes: Cls | Cls[] | null }
      | undefined;
    const nextCls = next ? ((Array.isArray(next.classes) ? next.classes[0] : next.classes) as Cls | null) : null;
    const fmt = next
      ? Object.fromEntries(
          new Intl.DateTimeFormat("es-AR", {
            timeZone: tz,
            weekday: "short",
            hour: "2-digit",
            minute: "2-digit",
            hourCycle: "h23",
          })
            .formatToParts(new Date(next.starts_at))
            .map((x) => [x.type, x.value]),
        )
      : null;

    const pendientes = ((pastRaw ?? []) as { class_reservations: { status: string }[] | null }[]).filter((o) =>
      (o.class_reservations ?? []).some((r) => r.status === "booked"),
    ).length;

    pulse = {
      next:
        next && fmt
          ? {
              time: `${fmt.hour}:${fmt.minute}`,
              day: String(fmt.weekday).replace(".", ""),
              name: nextCls?.name ?? "Clase",
              booked: next.booked_count,
              capacity: next.capacity,
            }
          : null,
      pendientes,
    };
  }

  return (
    <div id="instructor-shell" style={style} className="min-h-dvh">
      <InstructorSidebar studioName={studioName} logo={logo} userName={userName} pulse={pulse} />
      <div className="canvas-aurora min-h-dvh pb-20 lg:pb-0 lg:pl-60">{children}</div>
      <PushPrompt />
    </div>
  );
}
