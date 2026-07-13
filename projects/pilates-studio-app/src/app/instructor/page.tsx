import { redirect } from "next/navigation";
import Link from "next/link";
import { LogOut, CalendarDays, Users, Clock3, CheckCircle2, Circle, UserRound, UserX, Sparkles, StickyNote } from "lucide-react";
import { createSupabaseServer } from "@/lib/supabase/server";
import { setAttendance } from "./actions";
import { SuspendedScreen } from "@/components/suspended-screen";

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

type ProfileRel = { full_name: string };
type ClassRel = { id: string; name: string; instructor_id: string | null };

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

  // Estudio suspendido (Fase 5): la vista del instructor también se pausa.
  if (studio?.status === "suspended") {
    return <SuspendedScreen studioName={studio.name} audience="member" />;
  }

  // Desde 24 h atrás: la asistencia se marca durante/después de la clase, así que
  // las ocurrencias recientes tienen que seguir visibles (no solo las futuras).
  const from = new Date();
  from.setHours(from.getHours() - 24);
  const fromIso = from.toISOString();

  // Mis ocurrencias (recientes + próximas): clases donde soy el instructor asignado.
  const { data: occsRaw } = await supabase
    .from("class_occurrences")
    .select("id, starts_at, capacity, booked_count, classes!inner(id, name, instructor_id)")
    .eq("status", "scheduled")
    .gte("starts_at", fromIso)
    .eq("classes.instructor_id", myId)
    .order("starts_at", { ascending: true })
    .limit(40);

  const occs = ((occsRaw ?? []) as unknown as {
    id: string;
    starts_at: string;
    capacity: number;
    booked_count: number;
    classes: ClassRel | ClassRel[] | null;
  }[]).map((o) => {
    const cls = Array.isArray(o.classes) ? o.classes[0] : o.classes;
    return {
      id: o.id,
      startsAt: o.starts_at,
      capacity: o.capacity,
      booked: o.booked_count,
      className: cls?.name ?? "Clase",
    };
  });

  const selectedId = occ && occs.some((o) => o.id === occ) ? occ : occs[0]?.id ?? null;
  const selected = occs.find((o) => o.id === selectedId) ?? null;

  // Roster + asistencia de la ocurrencia seleccionada. Vía RPC SECURITY DEFINER: el
  // instructor no tiene SELECT sobre members/profiles (RLS), así que el nombre + el
  // estado vienen de instructor_class_roster (autoriza al instructor de esa clase).
  let roster: {
    id: string;
    name: string;
    att: "checked_in" | "no_show" | null;
    note: string | null;
    firstTime: boolean;
  }[] = [];
  if (selectedId) {
    const { data: rows } = await supabase.rpc("instructor_class_roster", {
      p_occurrence_id: selectedId,
    });
    roster = ((rows ?? []) as {
      reservation_id: string;
      member_name: string;
      attendance_status: string | null;
      member_note: string | null;
      is_first_time: boolean;
    }[]).map((r) => ({
      id: r.reservation_id,
      name: r.member_name,
      att: (r.attendance_status as "checked_in" | "no_show" | null) ?? null,
      note: r.member_note ?? null,
      firstTime: Boolean(r.is_first_time),
    }));
  }

  const presentCount = roster.filter((r) => r.att === "checked_in").length;
  const classStarted = selected ? selected.startsAt <= new Date().toISOString() : false;

  return (
    <main className="mx-auto min-h-dvh w-full max-w-5xl px-5 pb-16 pt-8 lg:px-8">
      {/* header */}
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{studio?.name ?? "Tu estudio"}</p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Hola, {firstName(prof?.full_name)}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Tus próximas clases y quiénes están anotados.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <a
            href="/cuenta"
            aria-label="Mi cuenta"
            className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-secondary"
          >
            <UserRound className="size-3.5" aria-hidden />
            <span className="hidden sm:inline">Mi cuenta</span>
          </a>
          <a
            href="/logout"
            aria-label="Cerrar sesión"
            className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-secondary"
          >
            <LogOut className="size-3.5" aria-hidden />
            Salir
          </a>
        </div>
      </header>

      {notice ? (
        <p className="mt-5 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">{notice}</p>
      ) : null}
      {error ? (
        <p className="mt-5 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {occs.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border bg-card/60 px-6 py-14 text-center">
          <CalendarDays className="mx-auto size-6 text-muted-foreground" aria-hidden />
          <p className="mt-3 text-sm text-muted-foreground">
            No tenés clases próximas asignadas. Cuando el estudio te asigne una clase, va a aparecer acá.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start">
          {/* lista de mis ocurrencias próximas */}
          <nav className="grid gap-2">
            {occs.map((o) => {
              const { day, time } = fmtDateTime(o.startsAt, tz);
              const isSel = o.id === selectedId;
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
                    <p className="text-xs capitalize text-muted-foreground">
                      {day} · {time} hs
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-medium text-foreground">
                    {o.booked}/{o.capacity}
                  </span>
                </Link>
              );
            })}
          </nav>

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

              {roster.length > 0 ? (
                <>
                  {!classStarted ? (
                    <p className="mt-3 rounded-lg bg-surface-sunken px-3 py-2 text-xs text-muted-foreground">
                      La asistencia se marca cuando empieza la clase.
                    </p>
                  ) : null}
                  <ul className="mt-4 divide-y divide-border">
                    {roster.map((r) => (
                      <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                        <span className="min-w-0">
                          <span className="flex flex-wrap items-center gap-2 text-sm text-foreground">
                            {r.name}
                            {r.firstTime ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary-ink">
                                <Sparkles className="size-3" aria-hidden />
                                1ª clase
                              </span>
                            ) : null}
                          </span>
                          {r.note ? (
                            <span className="mt-0.5 flex items-start gap-1 text-xs text-warning">
                              <StickyNote className="mt-0.5 size-3 shrink-0" aria-hidden />
                              {r.note}
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
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">Todavía no hay anotados en esta clase.</p>
              )}
            </section>
          ) : null}
        </div>
      )}
    </main>
  );
}
