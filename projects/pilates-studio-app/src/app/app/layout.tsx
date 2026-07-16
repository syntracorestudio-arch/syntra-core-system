import type { CSSProperties, ReactNode } from "react";
import { createSupabaseServer } from "@/lib/supabase/server";
import { accentForeground } from "@/lib/accent";
import { StudentSidebar, type SaldoWidget, type StudentNotif } from "@/components/shell/student-sidebar";
import { SuspendedScreen } from "@/components/suspended-screen";
import { PushPrompt } from "@/components/push-prompt";

export const dynamic = "force-dynamic";

const DEFAULT_TZ = "America/Argentina/Buenos_Aires";

/**
 * Shell del ALUMNO: sidebar carbón (desktop) / bottom-bar (mobile) con la marca del
 * estudio, novedades propias y el saldo siempre a mano. Mismo patrón que /admin:
 * el acento white-label se aplica en runtime sobre las vars de Tailwind v4.
 * La guarda de auth la hace cada página; acá solo se arma el chrome.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: member } = user
    ? await supabase
        .from("members")
        .select("id, role, studios(name, branding, status, timezone)")
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

  // Estudio suspendido (Fase 5): la app del alumno queda en pausa.
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

  const userName = (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? "Alumno";
  const isStaff = member?.role === "admin" || member?.role === "reception";

  // ── Saldo para el widget (mismas tablas base que /app; RLS del alumno) ──
  let saldo: SaldoWidget = { text: "—", hint: null, warn: false };
  let notifications: StudentNotif[] = [];
  let unreadCount = 0;
  if (user && member) {
    const tz = studio?.timezone || DEFAULT_TZ;
    const nowIso = new Date().toISOString();
    const todayDate = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());

    const [{ data: passes }, { data: mships }, notifRes, unreadRes] = await Promise.all([
      supabase.from("member_passes").select("id, expires_at").gt("expires_at", nowIso),
      supabase.from("memberships").select("id").eq("status", "active").gte("valid_to", todayDate),
      supabase
        .from("notifications")
        .select("id, title, body, link, read_at, created_at")
        .not("member_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .not("member_id", "is", null)
        .is("read_at", null),
    ]);

    const validPasses = (passes ?? []) as { id: string; expires_at: string }[];
    let credits = 0;
    let nearestExpiry: string | null = null;
    if (validPasses.length > 0) {
      const { data: ledger } = await supabase
        .from("credit_ledger")
        .select("delta, member_pass_id")
        .in("member_pass_id", validPasses.map((p) => p.id));
      const byPass = new Map<string, number>();
      for (const l of (ledger ?? []) as { delta: number; member_pass_id: string }[]) {
        byPass.set(l.member_pass_id, (byPass.get(l.member_pass_id) ?? 0) + l.delta);
        credits += l.delta;
      }
      nearestExpiry =
        validPasses
          .filter((p) => (byPass.get(p.id) ?? 0) > 0)
          .map((p) => p.expires_at)
          .sort()[0] ?? null;
    }
    const hasMembership = (mships ?? []).length > 0;
    const expiryLabel = nearestExpiry
      ? new Intl.DateTimeFormat("es-AR", { timeZone: tz, day: "numeric", month: "long" }).format(new Date(nearestExpiry))
      : "";
    const expiresSoon =
      credits > 0 && nearestExpiry
        ? new Date(nearestExpiry).getTime() - new Date(nowIso).getTime() < 5 * 86_400_000
        : false;

    saldo = hasMembership
      ? { text: "Abono activo", hint: null, warn: false }
      : credits > 0
        ? {
            text: credits === 1 ? "1 clase" : `${credits} clases`,
            hint: nearestExpiry ? `${credits === 1 ? "Es tu última clase — vence" : "Vencen"} el ${expiryLabel}` : null,
            warn: credits === 1 || expiresSoon,
          }
        : { text: "Sin créditos", hint: "Comprá un pack para reservar", warn: true };

    notifications = ((notifRes.data ?? []) as {
      id: string;
      title: string;
      body: string | null;
      link: string | null;
      read_at: string | null;
      created_at: string;
    }[]).map((n) => ({ id: n.id, title: n.title, body: n.body, link: n.link, read: !!n.read_at, createdAt: n.created_at }));
    unreadCount = ("count" in unreadRes ? unreadRes.count : 0) ?? 0;
  }

  return (
    <div id="app-shell" style={style} className="min-h-dvh">
      <StudentSidebar
        studioName={studioName}
        logo={logo}
        userName={userName}
        saldo={saldo}
        isStaff={isStaff}
        notifications={notifications}
        unreadCount={unreadCount}
      />
      <div className="canvas-aurora min-h-dvh pb-20 lg:pb-0 lg:pl-60">{children}</div>
      <PushPrompt />
    </div>
  );
}
