import Link from "next/link";
import { redirect } from "next/navigation";
import { Sun, Users, CheckCircle2, UserX, AlertCircle, MessageCircle, ChevronRight } from "lucide-react";
import { createSupabaseServer } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/page-header";
import { FinancialBadge, type FinancialStatus } from "@/components/admin/financial-badge";
import { setTodayAttendance } from "./actions";

export const metadata = { title: "Hoy — Panel" };
export const dynamic = "force-dynamic";

const ADMIN_ROLES = ["admin", "reception"];
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

type ProfileRel = { full_name: string; phone: string | null };
type MemberRel = { id: string; profiles: ProfileRel | ProfileRel[] | null };
type AttRel = { status: string } | { status: string }[] | null;
type ClsRel = { name: string; instructor_name: string | null } | { name: string; instructor_name: string | null }[] | null;

export default async function HoyPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("members")
    .select("role, studios(name, timezone)")
    .eq("profile_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!me || !ADMIN_ROLES.includes(me.role)) redirect("/app");
  const sRel = (me.studios ?? null) as { name: string; timezone: string | null } | { name: string; timezone: string | null }[] | null;
  const studio = Array.isArray(sRel) ? sRel[0] : sRel;
  const tz = studio?.timezone || DEFAULT_TZ;

  const nowIso = new Date().toISOString();
  const todayLocal = tzDate(nowIso, tz);
  const todayStart = localToUtcISO(todayLocal, "00:00", tz);
  const todayEnd = localToUtcISO(todayLocal, "23:59", tz);

  // Clases de hoy + roster con estado financiero (recepción vive en esta pantalla).
  const [{ data: occRaw }, { data: finsRaw }] = await Promise.all([
    supabase
      .from("class_occurrences")
      .select("id, starts_at, capacity, booked_count, classes(name, instructor_name)")
      .eq("status", "scheduled")
      .gte("starts_at", todayStart)
      .lte("starts_at", todayEnd)
      .order("starts_at", { ascending: true }),
    supabase.from("member_financial_status").select("member_id, financial_status"),
  ]);
  const occs = (occRaw ?? []) as { id: string; starts_at: string; capacity: number; booked_count: number; classes: ClsRel }[];
  const finByMember = new Map(
    ((finsRaw ?? []) as { member_id: string; financial_status: FinancialStatus }[]).map((f) => [f.member_id, f.financial_status]),
  );

  // Rosters de todas las clases de hoy en una sola query
  const occIds = occs.map((o) => o.id);
  type ResRow = { id: string; occurrence_id: string; member_id: string; members: MemberRel | MemberRel[] | null; attendance: AttRel };
  let resRows: ResRow[] = [];
  if (occIds.length > 0) {
    const { data } = await supabase
      .from("class_reservations")
      .select("id, occurrence_id, member_id, members(id, profiles(full_name, phone)), attendance(status)")
      .in("occurrence_id", occIds)
      .in("status", ["booked", "attended", "no_show"]);
    resRows = (data ?? []) as unknown as ResRow[];
  }
  const byOcc = new Map<string, { id: string; memberId: string; name: string; phone: string | null; att: "checked_in" | "no_show" | null }[]>();
  for (const r of resRows) {
    const m = Array.isArray(r.members) ? r.members[0] : r.members;
    const prof = m ? (Array.isArray(m.profiles) ? m.profiles[0] : m.profiles) : null;
    const a = Array.isArray(r.attendance) ? r.attendance[0] : r.attendance;
    const list = byOcc.get(r.occurrence_id) ?? [];
    list.push({
      id: r.id,
      memberId: r.member_id,
      name: prof?.full_name ?? "Alumno",
      phone: prof?.phone ?? null,
      att: (a?.status as "checked_in" | "no_show" | undefined) ?? null,
    });
    byOcc.set(r.occurrence_id, list);
  }

  const dayLabel = new Intl.DateTimeFormat("es-AR", { timeZone: tz, weekday: "long", day: "numeric", month: "long" }).format(
    new Date(nowIso),
  );

  return (
    <main className="mx-auto min-h-dvh w-full max-w-4xl px-5 pb-16 pt-8 lg:px-8">
      <PageHeader title="Hoy" subtitle={`${studio?.name ?? "Tu estudio"} · ${dayLabel}`} />

      {error ? (
        <p className="mt-5 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}

      {occs.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border bg-card/60 px-6 py-14 text-center">
          <Sun className="mx-auto size-6 text-muted-foreground" aria-hidden />
          <p className="mt-3 text-sm text-muted-foreground">Hoy no hay clases programadas.</p>
        </div>
      ) : (
        <div className="mt-6 grid gap-4">
          {occs.map((o) => {
            const cls = Array.isArray(o.classes) ? o.classes[0] : o.classes;
            const roster = (byOcc.get(o.id) ?? []).sort((a, b) => a.name.localeCompare(b.name));
            const started = o.starts_at <= nowIso;
            const present = roster.filter((r) => r.att === "checked_in").length;
            return (
              <section key={o.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-baseline gap-3">
                    <span className="text-xl font-bold tabular-nums text-foreground">{timeOf(o.starts_at, tz)}</span>
                    <div>
                      <h2 className="text-base font-semibold text-foreground">{cls?.name ?? "Clase"}</h2>
                      {cls?.instructor_name ? (
                        <p className="text-xs text-muted-foreground">con {cls.instructor_name}</p>
                      ) : null}
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
                    <Users className="size-3.5" aria-hidden />
                    {started ? `${present}/${roster.length} presentes` : `${roster.length} anotados`}
                  </span>
                </div>

                {roster.length > 0 ? (
                  <ul className="mt-3 divide-y divide-border">
                    {roster.map((r) => {
                      const debtor = (finByMember.get(r.memberId) ?? "al_dia") !== "al_dia";
                      const phone = (r.phone ?? "").replace(/[^\d]/g, "");
                      return (
                        <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                          <span className="flex min-w-0 flex-1 items-center gap-2">
                            <Link href={`/admin/alumnos/${r.memberId}`} className="truncate text-sm text-foreground hover:underline">
                              {r.name}
                            </Link>
                            {debtor ? <FinancialBadge status={finByMember.get(r.memberId) as FinancialStatus} /> : null}
                            {debtor && phone ? (
                              <a
                                href={`https://wa.me/${phone}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="WhatsApp"
                                className="flex size-7 items-center justify-center rounded-lg bg-success/10 text-success transition-colors hover:bg-success/20"
                              >
                                <MessageCircle className="size-3.5" aria-hidden />
                              </a>
                            ) : null}
                          </span>
                          {started ? (
                            <span className="flex items-center gap-1.5">
                              <form action={setTodayAttendance}>
                                <input type="hidden" name="reservation" value={r.id} />
                                <input type="hidden" name="value" value={r.att === "checked_in" ? "clear" : "checked_in"} />
                                <button
                                  type="submit"
                                  className={`inline-flex min-h-9 items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                                    r.att === "checked_in"
                                      ? "border-success/40 bg-success/10 text-success"
                                      : "border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
                                  }`}
                                >
                                  <CheckCircle2 className="size-3.5" aria-hidden />
                                  Presente
                                </button>
                              </form>
                              <form action={setTodayAttendance}>
                                <input type="hidden" name="reservation" value={r.id} />
                                <input type="hidden" name="value" value={r.att === "no_show" ? "clear" : "no_show"} />
                                <button
                                  type="submit"
                                  className={`inline-flex min-h-9 items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                                    r.att === "no_show"
                                      ? "border-destructive/40 bg-destructive/10 text-destructive"
                                      : "border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
                                  }`}
                                >
                                  <UserX className="size-3.5" aria-hidden />
                                  Faltó
                                </button>
                              </form>
                            </span>
                          ) : (
                            <Link
                              href={`/admin/alumnos/${r.memberId}`}
                              className="inline-flex items-center gap-0.5 text-xs font-semibold text-primary-ink hover:underline"
                            >
                              ficha <ChevronRight className="size-3.5" aria-hidden />
                            </Link>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">Sin anotados por ahora.</p>
                )}
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
