import Link from "next/link";
import { redirect } from "next/navigation";
import { Sun, Users, CheckCircle2, UserX, AlertCircle, MessageCircle, ChevronRight, StickyNote, Wallet, Hourglass, ArrowUp } from "lucide-react";
import { createSupabaseServer } from "@/lib/supabase/server";
import { PageHeader, HeaderStat } from "@/components/admin/page-header";
import { RoleHero } from "@/components/shell/role-hero";
import { FinancialBadge, type FinancialStatus } from "@/components/admin/financial-badge";
import { RadialGauge } from "@/components/admin/radial-gauge";
import { setTodayAttendance, promoteToday } from "./actions";

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
type MemberRel = { id: string; notes: string | null; profiles: ProfileRel | ProfileRel[] | null };
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
    .select("role, profiles(full_name), studios(name, timezone)")
    .eq("profile_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!me || !ADMIN_ROLES.includes(me.role)) redirect("/app");
  const profRel = (me.profiles ?? null) as { full_name: string } | { full_name: string }[] | null;
  const firstName = ((Array.isArray(profRel) ? profRel[0] : profRel)?.full_name ?? "").trim().split(/\s+/)[0] || "";
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

  // Rosters + colas de espera de todas las clases de hoy — en paralelo (independientes)
  const occIds = occs.map((o) => o.id);
  type ResRow = { id: string; occurrence_id: string; member_id: string; members: MemberRel | MemberRel[] | null; attendance: AttRel };
  type WaitRow = { id: string; occurrence_id: string; position: number; members: MemberRel | MemberRel[] | null };
  const [resRes, waitRes] = await Promise.all([
    occIds.length > 0
      ? supabase
          .from("class_reservations")
          .select("id, occurrence_id, member_id, members(id, notes, profiles(full_name, phone)), attendance(status)")
          .in("occurrence_id", occIds)
          .in("status", ["booked", "attended", "no_show"])
      : Promise.resolve({ data: null }),
    occIds.length > 0
      ? supabase
          .from("waitlist")
          .select("id, occurrence_id, position, members(id, notes, profiles(full_name, phone))")
          .in("occurrence_id", occIds)
          .eq("status", "waiting")
          .order("position", { ascending: true })
      : Promise.resolve({ data: null }),
  ]);
  const resRows = (resRes.data ?? []) as unknown as ResRow[];
  const waitRows = (waitRes.data ?? []) as unknown as WaitRow[];
  const waitByOcc = new Map<string, { id: string; name: string; phone: string | null }[]>();
  for (const w of waitRows) {
    const m = Array.isArray(w.members) ? w.members[0] : w.members;
    const prof = m ? (Array.isArray(m.profiles) ? m.profiles[0] : m.profiles) : null;
    const list = waitByOcc.get(w.occurrence_id) ?? [];
    list.push({ id: w.id, name: prof?.full_name ?? "Alumno", phone: prof?.phone ?? null });
    waitByOcc.set(w.occurrence_id, list);
  }

  const byOcc = new Map<
    string,
    { id: string; memberId: string; name: string; phone: string | null; note: string | null; att: "checked_in" | "no_show" | null }[]
  >();
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
      note: m?.notes ?? null,
      att: (a?.status as "checked_in" | "no_show" | undefined) ?? null,
    });
    byOcc.set(r.occurrence_id, list);
  }

  const dayLabel = new Intl.DateTimeFormat("es-AR", { timeZone: tz, weekday: "long", day: "numeric", month: "long" }).format(
    new Date(nowIso),
  );
  const totalReservas = [...byOcc.values()].reduce((s, l) => s + l.length, 0);

  // 🎂 Cumpleaños de HOY en todo el estudio (alumnos y equipo — motivo de contacto humano)
  const { data: bdayRaw } = await supabase
    .from("members")
    .select("id, profiles(full_name, birthday)")
    .eq("status", "active");
  const todayMD = todayLocal.slice(5); // MM-DD local del estudio
  const birthdays = ((bdayRaw ?? []) as { id: string; profiles: { full_name: string; birthday: string | null } | { full_name: string; birthday: string | null }[] | null }[])
    .map((m) => (Array.isArray(m.profiles) ? m.profiles[0] : m.profiles))
    .filter((p): p is { full_name: string; birthday: string } => Boolean(p?.birthday))
    .filter((p) => p.birthday.slice(5) === todayMD)
    .map((p) => p.full_name);

  return (
    <main className="mx-auto min-h-dvh w-full max-w-6xl px-5 pb-16 pt-8 lg:px-8">
      {me.role === "reception" ? (
        /* recepción ATERRIZA acá → hero de bienvenida con la foto (patrón del panel);
           el admin conserva la banda: su hero vive en Resumen */
        <RoleHero
          kicker={firstName ? `Hola, ${firstName}` : (studio?.name ?? "Tu estudio")}
          title="Hoy"
          subtitle={`${studio?.name ?? "Tu estudio"} · ${dayLabel}`}
        >
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/90 px-3 py-1.5 text-xs font-semibold text-foreground backdrop-blur">
            <Sun className="size-3.5 text-primary" aria-hidden />
            {occs.length} {occs.length === 1 ? "clase" : "clases"} · {totalReservas}{" "}
            {totalReservas === 1 ? "reserva" : "reservas"}
          </span>
        </RoleHero>
      ) : (
        <PageHeader
          title="Hoy"
          subtitle={`${studio?.name ?? "Tu estudio"} · ${dayLabel}`}
          icon={Sun}
          stat={
            <HeaderStat
              value={`${occs.length} ${occs.length === 1 ? "clase" : "clases"}`}
              caption={`${totalReservas} ${totalReservas === 1 ? "reserva" : "reservas"}`}
            />
          }
        />
      )}

      {error ? (
        <p className="mt-5 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}

      {/* 🎂 la app ya los saludó a las 8; esto es para el saludo EN PERSONA */}
      {birthdays.length > 0 ? (
        <p className="mt-5 rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 text-sm text-foreground">
          🎂 <span className="font-semibold">{birthdays.length === 1 ? "Cumple años hoy" : "Cumplen años hoy"}:</span>{" "}
          {birthdays.join(" · ")} — un saludo cuando {birthdays.length === 1 ? "pase" : "pasen"} por el estudio suma un
          montón.
        </p>
      ) : null}

      {occs.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border bg-card/60 px-6 py-14 text-center">
          <Sun className="mx-auto size-6 text-muted-foreground" aria-hidden />
          <p className="mt-3 text-sm text-muted-foreground">Hoy no hay clases programadas.</p>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-2 lg:items-start">
          {occs.map((o) => {
            const cls = Array.isArray(o.classes) ? o.classes[0] : o.classes;
            const roster = (byOcc.get(o.id) ?? []).sort((a, b) => a.name.localeCompare(b.name));
            const started = o.starts_at <= nowIso;
            // check-in de llegada: se habilita 20 min antes (la gente llega temprano);
            // "Faltó" recién cuando la clase empezó
            const checkinOpen = new Date(o.starts_at).getTime() - 20 * 60_000 <= new Date(nowIso).getTime();
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
                  {started && roster.length > 0 ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="relative inline-flex text-success">
                        <RadialGauge pct={(present / roster.length) * 100} size={40} stroke={5} />
                        <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold tabular-nums text-foreground">
                          {present}/{roster.length}
                        </span>
                      </span>
                      <span className="text-xs font-medium text-muted-foreground">presentes</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
                      <Users className="size-3.5" aria-hidden />
                      {roster.length} anotados
                    </span>
                  )}
                </div>

                {roster.length > 0 ? (
                  <ul className="mt-3 divide-y divide-border">
                    {roster.map((r) => {
                      const debtor = (finByMember.get(r.memberId) ?? "al_dia") !== "al_dia";
                      const phone = (r.phone ?? "").replace(/[^\d]/g, "");
                      return (
                        <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-2">
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
                              {debtor ? (
                                <Link
                                  href={`/admin/alumnos/${r.memberId}`}
                                  className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground transition-colors hover:opacity-90"
                                >
                                  <Wallet className="size-3" aria-hidden />
                                  cobrar
                                </Link>
                              ) : null}
                            </span>
                            {r.note ? (
                              <span className="mt-0.5 flex items-start gap-1 text-xs text-warning">
                                <StickyNote className="mt-0.5 size-3 shrink-0" aria-hidden />
                                {r.note}
                              </span>
                            ) : null}
                          </span>
                          {checkinOpen ? (
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
                                  {started ? "Presente" : "Llegó"}
                                </button>
                              </form>
                              {started ? (
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
                              ) : null}
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

                {/* cola de espera EN ORDEN — "Subir" solo con lugar libre (si está llena,
                    la cola se ve igual: recepción sabe a quién llamar si alguien avisa) */}
                {(waitByOcc.get(o.id) ?? []).length > 0 ? (
                  <div className="mt-3 rounded-xl border border-warning/25 bg-warning/5 px-3.5 py-2.5">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                      <Hourglass className="size-3.5 text-warning" aria-hidden />
                      En espera · {(waitByOcc.get(o.id) ?? []).length}
                    </p>
                    <ul className="mt-1.5 divide-y divide-warning/15">
                      {(waitByOcc.get(o.id) ?? []).map((w, i) => {
                        const wphone = (w.phone ?? "").replace(/[^\d]/g, "");
                        return (
                          <li key={w.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                            <span className="flex items-center gap-2 text-sm text-foreground">
                              <span className="flex size-5 items-center justify-center rounded-full bg-warning/15 text-[11px] font-bold tabular-nums text-foreground">
                                {i + 1}
                              </span>
                              {w.name}
                              {wphone ? (
                                <a
                                  href={`https://wa.me/${wphone}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="WhatsApp"
                                  className="flex size-6 items-center justify-center rounded-lg bg-success/10 text-success transition-colors hover:bg-success/20"
                                >
                                  <MessageCircle className="size-3" aria-hidden />
                                </a>
                              ) : null}
                            </span>
                            {o.booked_count < o.capacity && !started ? (
                              <form action={promoteToday}>
                                <input type="hidden" name="waitlist" value={w.id} />
                                <button
                                  type="submit"
                                  className="inline-flex min-h-8 items-center gap-1 rounded-full bg-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground transition-colors hover:opacity-90"
                                >
                                  <ArrowUp className="size-3" aria-hidden />
                                  Subir
                                </button>
                              </form>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
