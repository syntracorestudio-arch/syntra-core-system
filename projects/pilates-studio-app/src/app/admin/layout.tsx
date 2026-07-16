import type { CSSProperties, ReactNode } from "react";
import { createSupabaseServer } from "@/lib/supabase/server";
import { accentForeground } from "@/lib/accent";
import { AdminSidebar, type TodayPulse } from "@/components/admin/sidebar";

const DEFAULT_TZ = "America/Argentina/Buenos_Aires";

function localToUtcISO(dateStr: string, timeStr: string, tz: string) {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const [h, mi] = timeStr.split(":").map(Number);
  const asUTC = Date.UTC(y, mo - 1, d, h, mi);
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
      .formatToParts(new Date(asUTC))
      .map((x) => [x.type, x.value]),
  );
  const tzAsUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
  return new Date(asUTC - (tzAsUTC - asUTC)).toISOString();
}
function tzDate(iso: string, tz: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(new Date(iso))
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}`;
}
function timeOf(iso: string, tz: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date(iso))
      .map((x) => [x.type, x.value]),
  );
  return `${p.hour}:${p.minute}`;
}
import { SuspendedScreen } from "@/components/suspended-screen";
import { PushPrompt } from "@/components/push-prompt";

export const dynamic = "force-dynamic";

/**
 * Shell del panel admin: navegación por sidebar (desktop) / bottom-bar (mobile) +
 * marca del estudio white-label. Aplica el acento del estudio en runtime
 * (sobrescribe --primary/--ring/--primary-foreground, las vars de Tailwind v4).
 * La guarda de auth/rol la hace cada página; acá solo se arma el chrome.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: member } = user
    ? await supabase
        .from("members")
        .select("role, profiles(full_name), studios(name, branding, status, timezone)")
        .eq("profile_id", user.id)
        .limit(1)
        .maybeSingle()
    : { data: null };

  const role = (member?.role as string) ?? "reception";
  const profRel = (member?.profiles ?? null) as { full_name: string } | { full_name: string }[] | null;
  const userName = (Array.isArray(profRel) ? profRel[0] : profRel)?.full_name ?? "Equipo";

  const studioRel = (member?.studios ?? null) as
    | { name: string; branding: Record<string, unknown> | null; status: string; timezone: string | null }
    | { name: string; branding: Record<string, unknown> | null; status: string; timezone: string | null }[]
    | null;
  const studio = Array.isArray(studioRel) ? studioRel[0] : studioRel;
  const studioName = studio?.name ?? "Tu estudio";

  // Estudio suspendido (Fase 5): el panel completo queda bloqueado.
  if (studio?.status === "suspended") {
    return <SuspendedScreen studioName={studioName} audience="admin" />;
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

  // Avisos in-app (RLS: admin/recepción ven los de su estudio). Últimos 10 + no leídas.
  const [notifRes, unreadRes] = user
    ? await Promise.all([
        supabase
          .from("notifications")
          .select("id, title, body, link, read_at, created_at")
          .order("created_at", { ascending: false })
          .limit(10),
        supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
      ])
    : [{ data: null }, { count: 0 }];
  const notifications = ((notifRes.data ?? []) as {
    id: string;
    title: string;
    body: string | null;
    link: string | null;
    read_at: string | null;
    created_at: string;
  }[]).map((n) => ({ id: n.id, title: n.title, body: n.body, link: n.link, read: !!n.read_at, createdAt: n.created_at }));
  const unreadCount = ("count" in unreadRes ? unreadRes.count : 0) ?? 0;

  // ── Pulso del día para el widget del sidebar (queries livianas, RLS del usuario) ──
  let today: TodayPulse | null = null;
  if (user && member) {
    const tz = studio?.timezone || DEFAULT_TZ;
    const nowIso = new Date().toISOString();
    const todayLocal = tzDate(nowIso, tz);
    const dayStart = localToUtcISO(todayLocal, "00:00", tz);
    const dayEnd = localToUtcISO(todayLocal, "23:59", tz);
    const isAdmin = role === "admin";

    const [{ data: occsRaw }, paysRes, finsRes, memsRes] = await Promise.all([
      supabase
        .from("class_occurrences")
        .select("starts_at, ends_at, capacity, booked_count, classes(name, instructor_name)")
        .eq("status", "scheduled")
        .gte("starts_at", dayStart)
        .lte("starts_at", dayEnd)
        .order("starts_at", { ascending: true }),
      isAdmin
        ? supabase.from("payments").select("amount").eq("status", "confirmed").gte("paid_at", dayStart)
        : Promise.resolve({ data: null }),
      supabase.from("member_financial_status").select("member_id, financial_status"),
      supabase.from("members").select("id").eq("role", "client"),
    ]);

    type Cls = { name: string; instructor_name: string | null };
    const occs = (occsRaw ?? []) as { starts_at: string; ends_at: string; capacity: number; booked_count: number; classes: Cls | Cls[] | null }[];
    const current = occs.find((o) => o.starts_at <= nowIso && nowIso <= o.ends_at) ?? null;
    const next = occs.find((o) => o.starts_at > nowIso) ?? null;
    const focusOcc = current ?? next;
    const focusCls = focusOcc ? ((Array.isArray(focusOcc.classes) ? focusOcc.classes[0] : focusOcc.classes) as Cls | null) : null;

    const clientIds = new Set(((memsRes.data ?? []) as { id: string }[]).map((m) => m.id));
    const debtors = ((finsRes.data ?? []) as { member_id: string; financial_status: string }[]).filter(
      (f) => clientIds.has(f.member_id) && f.financial_status !== "al_dia",
    ).length;

    today = {
      focus: focusOcc
        ? {
            label: current ? "En curso" : "Próxima",
            time: timeOf(focusOcc.starts_at, tz),
            name: focusCls?.name ?? "Clase",
            instructor: focusCls?.instructor_name ?? null,
            booked: focusOcc.booked_count,
            capacity: focusOcc.capacity,
          }
        : null,
      classesCount: occs.length,
      bookedCount: occs.reduce((s, o) => s + o.booked_count, 0),
      collectedToday: isAdmin
        ? ((paysRes.data ?? []) as { amount: number }[]).reduce((s, p) => s + Number(p.amount), 0)
        : null,
      debtors,
    };
  }

  return (
    <div id="admin-shell" style={style} className="min-h-dvh">
      <AdminSidebar
        role={role}
        studioName={studioName}
        logo={logo}
        userName={userName}
        notifications={notifications}
        unreadCount={unreadCount}
        today={today}
      />
      <div className="canvas-aurora min-h-dvh pb-20 lg:pb-0 lg:pl-60">{children}</div>
      <PushPrompt />
    </div>
  );
}
