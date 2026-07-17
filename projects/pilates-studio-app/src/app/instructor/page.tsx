import { redirect } from "next/navigation";
import Link from "next/link";
import {
  CalendarDays,
  Users,
  Clock3,
  CheckCircle2,
  Circle,
  UserX,
  Sparkles,
  StickyNote,
  AlertCircle,
  CheckCheck,
  Hourglass,
  NotebookPen,
  Megaphone,
} from "lucide-react";
import { createSupabaseServer } from "@/lib/supabase/server";
import { setAttendance, markAllPresent, saveInstructorNote, reportIssue } from "./actions";
import { RoleHero } from "@/components/shell/role-hero";

export const metadata = { title: "Mis clases — Instructor" };
export const dynamic = "force-dynamic";

const DEFAULT_TZ = "America/Argentina/Buenos_Aires";

function fmtDateTime(iso: string, tz: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("es-AR", {
      timeZone: tz,
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(iso))
      .map((x) => [x.type, x.value]),
  );
  return {
    day: `${p.weekday} ${p.day} ${p.month}`.replace(/\./g, ""),
    time: `${p.hour}:${p.minute}`,
  };
}

/** YYYY-MM-DD local del estudio. */
function localDate(iso: string, tz: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(new Date(iso))
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}`;
}

/** Etiqueta de grupo del día: Hoy / Mañana / "jueves 17". */
function dayGroupLabel(dateKey: string, todayKey: string, tomorrowKey: string) {
  if (dateKey === todayKey) return "Hoy";
  if (dateKey === tomorrowKey) return "Mañana";
  return new Intl.DateTimeFormat("es-AR", { timeZone: "UTC", weekday: "long", day: "numeric" }).format(
    new Date(`${dateKey}T12:00:00Z`),
  );
}

type ProfileRel = { full_name: string };
type ClassRel = { id: string; name: string; instructor_id: string | null };
type ResRel = { status: string; member_id: string };
type OccRow = {
  id: string;
  starts_at: string;
  capacity: number;
  booked_count: number;
  classes: ClassRel | ClassRel[] | null;
  class_reservations?: ResRel[] | null;
};

function firstName(full: string | null | undefined): string {
  return (full ?? "").trim().split(/\s+/)[0] || "instructor";
}

export default async function InstructorPage({
  searchParams,
}: {
  searchParams: Promise<{ occ?: string; notice?: string; error?: string }>;
}) {
  const { occ, notice, error } = await searchParams;
  const supabase = await createSupabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("members")
    .select("id, role, profiles(full_name), studios(name, timezone, status)")
    .eq("profile_id", user.id)
    .limit(1)
    .maybeSingle();
  // Guard de rol: esta área es solo para instructores.
  if (!me) redirect("/login");
  if (me.role !== "instructor") redirect(me.role === "admin" || me.role === "reception" ? "/admin" : "/app");

  const myId = me.id as string;
  const prof = (Array.isArray(me.profiles) ? me.profiles[0] : me.profiles) as ProfileRel | null;
  const sRel = (me.studios ?? null) as
    | { name: string; timezone: string | null; status: string }
    | { name: string; timezone: string | null; status: string }[]
    | null;
  const studio = Array.isArray(sRel) ? sRel[0] : sRel;
  const tz = studio?.timezone || DEFAULT_TZ;

  const now = new Date();
  const nowIso = now.toISOString();
  // Desde 24 h atrás: la asistencia se marca durante/después de la clase.
  const fromIso = new Date(now.getTime() - 24 * 3600_000).toISOString();
  // Ventana hacia atrás para historial + clases sin cerrar (60 días).
  const pastFromIso = new Date(now.getTime() - 60 * 86_400_000).toISOString();

  // Mis ocurrencias próximas/recientes + PASADAS (con estado de reservas: el
  // instructor puede leer class_reservations de su estudio por RLS).
  const [{ data: upcomingRaw }, { data: pastRaw }] = await Promise.all([
    supabase
      .from("class_occurrences")
      .select("id, starts_at, capacity, booked_count, classes!inner(id, name, instructor_id)")
      .eq("status", "scheduled")
      .gte("starts_at", fromIso)
      .eq("classes.instructor_id", myId)
      .order("starts_at", { ascending: true })
      .limit(40),
    supabase
      .from("class_occurrences")
      .select(
        "id, starts_at, capacity, booked_count, classes!inner(id, name, instructor_id), class_reservations(status, member_id)",
      )
      .eq("status", "scheduled")
      .gte("starts_at", pastFromIso)
      .lt("starts_at", nowIso)
      .eq("classes.instructor_id", myId)
      .order("starts_at", { ascending: false })
      .limit(120),
  ]);

  const mapOcc = (o: OccRow) => {
    const cls = Array.isArray(o.classes) ? o.classes[0] : o.classes;
    const res = (o.class_reservations ?? []).filter((r) => r.status !== "cancelled");
    return {
      id: o.id,
      startsAt: o.starts_at,
      capacity: o.capacity,
      booked: o.booked_count,
      className: cls?.name ?? "Clase",
      reservations: res,
      unmarked: res.filter((r) => r.status === "booked").length,
      attended: res.filter((r) => r.status === "attended").length,
    };
  };
  const upcoming = ((upcomingRaw ?? []) as unknown as OccRow[]).map(mapOcc);
  const past = ((pastRaw ?? []) as unknown as OccRow[]).map(mapOcc);

  // Clases sin cerrar: ya pasaron (> 2 h) y quedó gente sin marcar — si no se
  // cierran, el dueño pierde la métrica de retención/no-shows en Reportes.
  const staleIso = new Date(now.getTime() - 2 * 3600_000).toISOString();
  const upcomingIds = new Set(upcoming.map((o) => o.id));
  const pendientes = past.filter((o) => o.startsAt < staleIso && o.unmarked > 0 && !upcomingIds.has(o.id));

  // Ficha rápida por alumno: cómo viene CONMIGO (asistencias / total y última vez),
  // derivada de mis clases pasadas ya cargadas — cero queries extra.
  const memberStats = new Map<string, { attended: number; total: number; lastAttended: string | null }>();
  for (const o of past) {
    for (const r of o.reservations) {
      const s = memberStats.get(r.member_id) ?? { attended: 0, total: 0, lastAttended: null };
      if (r.status !== "booked") s.total += 1;
      if (r.status === "attended") {
        s.attended += 1;
        if (!s.lastAttended || o.startsAt > s.lastAttended) s.lastAttended = o.startsAt;
      }
      memberStats.set(r.member_id, s);
    }
  }
  const fmtShortDay = (iso: string) =>
    new Intl.DateTimeFormat("es-AR", { timeZone: tz, day: "numeric", month: "short" })
      .format(new Date(iso))
      .replace(/\./g, "");

  // Lista de espera por ocurrencia próxima (RPC 024 — solo números, nunca nombres).
  const waitByOcc = new Map<string, number>();
  if (upcoming.length > 0) {
    const { data: wl } = await supabase.rpc("instructor_waitlist_counts", {
      p_occurrence_ids: upcoming.map((o) => o.id),
    });
    for (const w of (wl ?? []) as { occurrence_id: string; waiting_count: number }[]) {
      waitByOcc.set(w.occurrence_id, w.waiting_count);
    }
  }

  // Selección: ?occ válido entre próximas o sin-cerrar; default = primera próxima.
  const selectable = [...upcoming, ...pendientes];
  const selectedId = occ && selectable.some((o) => o.id === occ) ? occ : upcoming[0]?.id ?? pendientes[0]?.id ?? null;
  const selected = selectable.find((o) => o.id === selectedId) ?? null;

  // Roster + asistencia de la ocurrencia seleccionada (RPC SECURITY DEFINER).
  let roster: {
    id: string;
    memberId: string;
    name: string;
    att: "checked_in" | "no_show" | null;
    note: string | null;
    firstTime: boolean;
    myNote: string | null;
    birthday: boolean;
  }[] = [];
  if (selectedId) {
    const { data: rows } = await supabase.rpc("instructor_class_roster", {
      p_occurrence_id: selectedId,
    });
    roster = ((rows ?? []) as {
      reservation_id: string;
      member_id: string;
      member_name: string;
      attendance_status: string | null;
      member_note: string | null;
      is_first_time: boolean;
      instructor_note: string | null;
      is_birthday: boolean;
    }[]).map((r) => ({
      id: r.reservation_id,
      memberId: r.member_id,
      name: r.member_name,
      att: (r.attendance_status as "checked_in" | "no_show" | null) ?? null,
      note: r.member_note ?? null,
      firstTime: Boolean(r.is_first_time),
      myNote: r.instructor_note ?? null,
      birthday: Boolean(r.is_birthday),
    }));
  }

  // Cola de espera EN ORDEN de la clase seleccionada (RPC 027: solo su clase, solo nombres)
  let waitQueue: { position: number; name: string }[] = [];
  if (selectedId && (waitByOcc.get(selectedId) ?? 0) > 0) {
    const { data: wq } = await supabase.rpc("instructor_waitlist", { p_occurrence_id: selectedId });
    waitQueue = ((wq ?? []) as { queue_position: number; member_name: string }[]).map((w) => ({
      position: w.queue_position,
      name: w.member_name,
    }));
  }

  const presentCount = roster.filter((r) => r.att === "checked_in").length;
  const unmarkedCount = roster.filter((r) => r.att === null).length;
  const classStarted = selected ? selected.startsAt <= nowIso : false;

  // Agenda agrupada por día local (Hoy / Mañana / día).
  const todayKey = localDate(nowIso, tz);
  const tomorrowKey = localDate(new Date(now.getTime() + 86_400_000).toISOString(), tz);
  const byDay: { key: string; label: string; items: typeof upcoming }[] = [];
  for (const o of upcoming) {
    const key = localDate(o.startsAt, tz);
    const last = byDay[byDay.length - 1];
    if (last && last.key === key) last.items.push(o);
    else byDay.push({ key, label: dayGroupLabel(key, todayKey, tomorrowKey), items: [o] });
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-5xl px-5 pb-16 pt-8 lg:px-8">
      {/* hero con la foto del estudio — mismo patrón aprobado del panel */}
      <RoleHero
        kicker={studio?.name ?? "Tu estudio"}
        title={`Hola, ${firstName(prof?.full_name)}`}
        subtitle="Tus próximas clases y quiénes están anotados."
      />

      {notice ? (
        <p className="mt-5 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">{notice}</p>
      ) : null}
      {error ? (
        <p className="mt-5 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {/* clases sin cerrar: si no se marcan, el estudio pierde el dato */}
      {pendientes.length > 0 ? (
        <div className="mt-5 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-medium text-foreground">
            <AlertCircle className="size-4 shrink-0 text-warning" aria-hidden />
            {pendientes.length === 1
              ? "Tenés 1 clase sin asistencia cargada."
              : `Tenés ${pendientes.length} clases sin asistencia cargada.`}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {pendientes.slice(0, 4).map((o) => {
              const { day, time } = fmtDateTime(o.startsAt, tz);
              return (
                <Link
                  key={o.id}
                  href={`/instructor?occ=${o.id}`}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    o.id === selectedId
                      ? "border-warning bg-warning/15 text-foreground"
                      : "border-border bg-card text-foreground hover:bg-secondary"
                  }`}
                >
                  <Hourglass className="size-3" aria-hidden />
                  {o.className} · {day} {time}
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}

      {upcoming.length === 0 && pendientes.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border bg-card/60 px-6 py-14 text-center">
          <CalendarDays className="mx-auto size-6 text-muted-foreground" aria-hidden />
          <p className="mt-3 text-sm text-muted-foreground">
            No tenés clases próximas asignadas. Cuando el estudio te asigne una clase, va a aparecer acá.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start">
          <div className="grid gap-5">
            {/* agenda agrupada por día */}
            <nav className="grid gap-3">
              {byDay.map((g) => (
                <div key={g.key}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <span className="capitalize">{g.label}</span>
                  </p>
                  <div className="mt-1.5 grid gap-2">
                    {g.items.map((o) => {
                      const { time } = fmtDateTime(o.startsAt, tz);
                      const isSel = o.id === selectedId;
                      const waiting = waitByOcc.get(o.id) ?? 0;
                      return (
                        <Link
                          key={o.id}
                          href={`/instructor?occ=${o.id}`}
                          className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-colors ${
                            isSel ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-secondary"
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">{o.className}</p>
                            <p className="text-xs text-muted-foreground">
                              {time} hs
                              {waiting > 0 ? (
                                <span className="text-warning"> · {waiting} en espera</span>
                              ) : null}
                            </p>
                          </div>
                          <span className="shrink-0 text-sm font-medium text-foreground">
                            {o.booked}/{o.capacity}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>

          </div>

          {/* roster + check-in de la ocurrencia seleccionada */}
          {selected ? (
            <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold text-foreground">{selected.className}</h2>
                  <p className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                    <Clock3 className="size-3.5" aria-hidden />
                    {(() => {
                      const { day, time } = fmtDateTime(selected.startsAt, tz);
                      return `${day} · ${time} hs`;
                    })()}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
                  <Users className="size-3.5" aria-hidden />
                  {presentCount}/{roster.length} presentes
                </span>
              </div>

              {/* imprevisto: solo clases futuras — avisa al panel del estudio */}
              {!classStarted ? (
                <details className="mt-3 rounded-lg border border-border bg-surface-sunken/60">
                  <summary className="flex cursor-pointer items-center gap-1.5 px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden">
                    <Megaphone className="size-3.5" aria-hidden />
                    ¿No podés dar esta clase? Avisale al estudio
                  </summary>
                  <form action={reportIssue} className="grid gap-2 border-t border-border p-3">
                    <input type="hidden" name="occ" value={selected.id} />
                    <textarea
                      name="message"
                      required
                      maxLength={300}
                      rows={2}
                      placeholder="Contá brevemente qué pasó (ej.: estoy enfermo, no llego a las 18)…"
                      className="w-full resize-none rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <button
                      type="submit"
                      className="justify-self-start rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:opacity-90"
                    >
                      Enviar aviso
                    </button>
                  </form>
                </details>
              ) : null}

              {roster.length > 0 ? (
                <>
                  {!classStarted ? (
                    <p className="mt-3 rounded-lg bg-surface-sunken px-3 py-2 text-xs text-muted-foreground">
                      La asistencia se marca cuando empieza la clase.
                    </p>
                  ) : null}
                  {classStarted && unmarkedCount > 1 ? (
                    <form action={markAllPresent} className="mt-3">
                      <input type="hidden" name="occ" value={selected.id} />
                      <button
                        type="submit"
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-success/40 bg-success/10 px-4 py-2 text-sm font-semibold text-success transition-colors hover:bg-success/15"
                      >
                        <CheckCheck className="size-4" aria-hidden />
                        Marcar todos presentes ({unmarkedCount})
                      </button>
                    </form>
                  ) : null}
                  <ul className="mt-4 divide-y divide-border">
                    {roster.map((r) => (
                      <li key={r.id} className="py-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                        <span className="min-w-0">
                          <span className="flex flex-wrap items-center gap-2 text-sm text-foreground">
                            {r.name}
                            {r.birthday ? (
                              <span
                                title="¡Hoy cumple años!"
                                className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-medium text-foreground"
                              >
                                🎂 cumple hoy
                              </span>
                            ) : null}
                            {r.firstTime ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary-ink">
                                <Sparkles className="size-3" aria-hidden />
                                1ª clase
                              </span>
                            ) : null}
                            {/* ficha rápida: cómo viene CONMIGO (a partir de 2 clases cerradas) */}
                            {(() => {
                              const s = memberStats.get(r.memberId);
                              return s && s.total >= 2 ? (
                                <span className="text-[11px] text-muted-foreground">
                                  {Math.round((s.attended / s.total) * 100)}% asistencia conmigo
                                  {s.lastAttended ? ` · última vez ${fmtShortDay(s.lastAttended)}` : ""}
                                </span>
                              ) : null;
                            })()}
                          </span>
                          {r.note ? (
                            <span className="mt-0.5 flex items-start gap-1 text-xs text-warning">
                              <StickyNote className="mt-0.5 size-3 shrink-0" aria-hidden />
                              {r.note}
                            </span>
                          ) : null}
                          {r.myNote ? (
                            <span className="mt-0.5 flex items-start gap-1 text-xs text-primary-ink">
                              <NotebookPen className="mt-0.5 size-3 shrink-0" aria-hidden />
                              {r.myNote}
                            </span>
                          ) : null}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {/* Presente (toggle) */}
                          <form action={setAttendance}>
                            <input type="hidden" name="reservation" value={r.id} />
                            <input type="hidden" name="occ" value={selected.id} />
                            <input type="hidden" name="value" value={r.att === "checked_in" ? "clear" : "checked_in"} />
                            <button
                              type="submit"
                              disabled={!classStarted}
                              className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                                r.att === "checked_in"
                                  ? "border-success/40 bg-success/10 text-success hover:bg-success/15"
                                  : "border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
                              }`}
                            >
                              {r.att === "checked_in" ? (
                                <CheckCircle2 className="size-4" aria-hidden />
                              ) : (
                                <Circle className="size-4" aria-hidden />
                              )}
                              Presente
                            </button>
                          </form>
                          {/* Faltó (toggle) */}
                          <form action={setAttendance}>
                            <input type="hidden" name="reservation" value={r.id} />
                            <input type="hidden" name="occ" value={selected.id} />
                            <input type="hidden" name="value" value={r.att === "no_show" ? "clear" : "no_show"} />
                            <button
                              type="submit"
                              disabled={!classStarted}
                              className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                                r.att === "no_show"
                                  ? "border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/15"
                                  : "border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
                              }`}
                            >
                              <UserX className="size-4" aria-hidden />
                              Faltó
                            </button>
                          </form>
                        </div>
                        </div>

                        {/* mi nota (privada, solo la ve este instructor) */}
                        <details className="mt-1.5">
                          <summary className="inline-flex cursor-pointer items-center gap-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden">
                            <NotebookPen className="size-3" aria-hidden />
                            {r.myNote ? "Editar mi nota" : "Mi nota"}
                          </summary>
                          <form action={saveInstructorNote} className="mt-2 flex items-start gap-2">
                            <input type="hidden" name="occ" value={selected.id} />
                            <input type="hidden" name="member" value={r.memberId} />
                            <textarea
                              name="note"
                              maxLength={500}
                              rows={2}
                              defaultValue={r.myNote ?? ""}
                              placeholder="Solo la ves vos (ej.: progresó en plancha, cuidar rodilla derecha)…"
                              className="w-full resize-none rounded-lg border border-border bg-surface-sunken/60 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-ring"
                            />
                            <button
                              type="submit"
                              className="shrink-0 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-secondary"
                            >
                              Guardar
                            </button>
                          </form>
                        </details>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">Todavía no hay anotados en esta clase.</p>
              )}

              {/* cola de espera en orden (solo lectura: promueve el sistema o recepción) */}
              {waitQueue.length > 0 ? (
                <div className="mt-4 rounded-xl border border-warning/25 bg-warning/5 px-3.5 py-2.5">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <Hourglass className="size-3.5 text-warning" aria-hidden />
                    En espera · {waitQueue.length}
                  </p>
                  <ul className="mt-1.5 grid gap-1">
                    {waitQueue.map((w) => (
                      <li key={w.position} className="flex items-center gap-2 text-sm text-foreground">
                        <span className="flex size-5 items-center justify-center rounded-full bg-warning/15 text-[11px] font-bold tabular-nums">
                          {w.position}
                        </span>
                        {w.name}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Si se libera un lugar, sube el primero automáticamente.
                  </p>
                </div>
              ) : null}
            </section>
          ) : null}
        </div>
      )}
    </main>
  );
}
