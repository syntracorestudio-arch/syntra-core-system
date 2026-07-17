import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft, User2, Users, Clock3, UserPlus, X, CalendarX, CheckCircle2, UserX } from "lucide-react";
import { createSupabaseServer } from "@/lib/supabase/server";
import { promoteWaitlist, removeReservation, cancelOccurrenceDetail, setOccurrenceAttendance } from "./actions";

export const dynamic = "force-dynamic";
const ADMIN_ROLES = ["admin", "reception"];
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
type MemberRel = { profiles: ProfileRel | ProfileRel[] | null };

function nameOf(rel: MemberRel | MemberRel[] | null): string {
  const m = Array.isArray(rel) ? rel[0] : rel;
  const p = m ? (Array.isArray(m.profiles) ? m.profiles[0] : m.profiles) : null;
  return p?.full_name ?? "Alumno";
}

export default async function ClaseDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ occ?: string; notice?: string; error?: string }>;
}) {
  const { id } = await params;
  const { occ, notice, error } = await searchParams;
  const supabase = await createSupabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("members")
    .select("role, studios(timezone)")
    .eq("profile_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!me || !ADMIN_ROLES.includes(me.role)) redirect("/app");
  const sRel = (me.studios ?? null) as { timezone: string | null } | { timezone: string | null }[] | null;
  const tz = (Array.isArray(sRel) ? sRel[0] : sRel)?.timezone || DEFAULT_TZ;

  // Desde 24 h atrás: la asistencia se marca durante/después de la clase.
  const from = new Date();
  from.setHours(from.getHours() - 24);
  const fromIso = from.toISOString();
  // Clase + ocurrencias en paralelo (independientes; si la clase no existe → 404 igual)
  const [{ data: klass }, { data: occsRaw }] = await Promise.all([
    supabase.from("classes").select("id, name, instructor_name").eq("id", id).maybeSingle(),
    supabase
      .from("class_occurrences")
      .select("id, starts_at, capacity, booked_count")
      .eq("class_id", id)
      .eq("status", "scheduled")
      .gte("starts_at", fromIso)
      .order("starts_at", { ascending: true })
      .limit(20),
  ]);
  if (!klass) notFound();
  const occs = (occsRaw ?? []) as { id: string; starts_at: string; capacity: number; booked_count: number }[];

  // contar waitlist por ocurrencia (para el badge en la lista)
  const occIds = occs.map((o) => o.id);
  const waitCounts = new Map<string, number>();
  if (occIds.length > 0) {
    const { data: wl } = await supabase
      .from("waitlist")
      .select("occurrence_id")
      .eq("status", "waiting")
      .in("occurrence_id", occIds);
    for (const w of (wl ?? []) as { occurrence_id: string }[]) {
      waitCounts.set(w.occurrence_id, (waitCounts.get(w.occurrence_id) ?? 0) + 1);
    }
  }

  const selectedId = occ && occs.some((o) => o.id === occ) ? occ : occs[0]?.id ?? null;
  const selected = occs.find((o) => o.id === selectedId) ?? null;

  let roster: { id: string; name: string; att: "checked_in" | "no_show" | null }[] = [];
  let waiting: { id: string; name: string; position: number }[] = [];
  if (selectedId) {
    const [{ data: res }, { data: wl }] = await Promise.all([
      supabase
        .from("class_reservations")
        .select("id, members(profiles(full_name)), attendance(status)")
        .eq("occurrence_id", selectedId)
        .in("status", ["booked", "attended", "no_show"]),
      supabase
        .from("waitlist")
        .select("id, position, members(profiles(full_name))")
        .eq("occurrence_id", selectedId)
        .eq("status", "waiting")
        .order("position", { ascending: true }),
    ]);
    type AttRel = { status: string } | { status: string }[] | null;
    roster = ((res ?? []) as { id: string; members: MemberRel | MemberRel[] | null; attendance: AttRel }[]).map((r) => {
      const a = Array.isArray(r.attendance) ? r.attendance[0] : r.attendance;
      return {
        id: r.id,
        name: nameOf(r.members),
        att: (a?.status as "checked_in" | "no_show" | undefined) ?? null,
      };
    });
    waiting = ((wl ?? []) as { id: string; position: number; members: MemberRel | MemberRel[] | null }[]).map((w) => ({
      id: w.id,
      name: nameOf(w.members),
      position: w.position,
    }));
  }

  const selFull = selected ? selected.booked_count >= selected.capacity : false;
  const selStarted = selected ? selected.starts_at <= new Date().toISOString() : false;

  return (
    <main className="mx-auto min-h-dvh w-full max-w-6xl px-5 pb-16 pt-8 lg:px-8">
      <Link
        href="/admin/clases"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Clases
      </Link>
      <header className="mt-3">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{klass.name}</h1>
        {klass.instructor_name ? (
          <p className="mt-1 inline-flex items-center gap-1 text-sm text-muted-foreground">
            <User2 className="size-3.5" aria-hidden />
            con {klass.instructor_name}
          </p>
        ) : null}
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
        <div className="mt-8 rounded-2xl border border-dashed border-border bg-card/60 px-6 py-12 text-center">
          <Clock3 className="mx-auto size-6 text-muted-foreground" aria-hidden />
          <p className="mt-3 text-sm text-muted-foreground">No hay clases próximas programadas.</p>
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start">
          {/* lista de ocurrencias próximas */}
          <nav className="grid gap-2">
            {occs.map((o) => {
              const { day, time } = fmtDateTime(o.starts_at, tz);
              const isSel = o.id === selectedId;
              const wc = waitCounts.get(o.id) ?? 0;
              return (
                <Link
                  key={o.id}
                  href={`/admin/clases/${id}?occ=${o.id}`}
                  className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-colors ${
                    isSel ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-secondary"
                  }`}
                >
                  <div>
                    <p className="text-sm font-semibold capitalize text-foreground">{day}</p>
                    <p className="text-xs text-muted-foreground">{time} hs</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-foreground">
                      {o.booked_count}/{o.capacity}
                    </p>
                    {wc > 0 ? <p className="text-xs text-warning">{wc} en espera</p> : null}
                  </div>
                </Link>
              );
            })}
          </nav>

          {/* detalle de la ocurrencia seleccionada */}
          {selected ? (
            <div className="grid gap-4">
              {/* roster */}
              <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <h2 className="inline-flex items-center gap-1.5 text-base font-semibold text-foreground">
                    <Users className="size-4 text-muted-foreground" aria-hidden />
                    Anotados
                  </h2>
                  <span className="text-sm text-muted-foreground">
                    {selected.booked_count}/{selected.capacity} lugares
                  </span>
                </div>
                {roster.length > 0 ? (
                  <ul className="mt-3 divide-y divide-border">
                    {roster.map((r) => (
                      <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                        <span className="text-sm text-foreground">{r.name}</span>
                        <div className="flex items-center gap-1.5">
                          {selStarted ? (
                            <>
                              {/* asistencia (clase ya empezada): presente / faltó, toggle */}
                              <form action={setOccurrenceAttendance}>
                                <input type="hidden" name="reservation" value={r.id} />
                                <input type="hidden" name="classId" value={id} />
                                <input type="hidden" name="occ" value={selected.id} />
                                <input type="hidden" name="value" value={r.att === "checked_in" ? "clear" : "checked_in"} />
                                <button
                                  type="submit"
                                  className={`inline-flex min-h-11 items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                                    r.att === "checked_in"
                                      ? "border-success/40 bg-success/10 text-success hover:bg-success/15"
                                      : "border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
                                  }`}
                                >
                                  <CheckCircle2 className="size-3.5" aria-hidden />
                                  Presente
                                </button>
                              </form>
                              <form action={setOccurrenceAttendance}>
                                <input type="hidden" name="reservation" value={r.id} />
                                <input type="hidden" name="classId" value={id} />
                                <input type="hidden" name="occ" value={selected.id} />
                                <input type="hidden" name="value" value={r.att === "no_show" ? "clear" : "no_show"} />
                                <button
                                  type="submit"
                                  className={`inline-flex min-h-11 items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                                    r.att === "no_show"
                                      ? "border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/15"
                                      : "border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
                                  }`}
                                >
                                  <UserX className="size-3.5" aria-hidden />
                                  Faltó
                                </button>
                              </form>
                            </>
                          ) : (
                            <form action={removeReservation}>
                              <input type="hidden" name="reservation" value={r.id} />
                              <input type="hidden" name="classId" value={id} />
                              <input type="hidden" name="occ" value={selected.id} />
                              <button
                                type="submit"
                                className="inline-flex min-h-11 items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                              >
                                <X className="size-3.5" aria-hidden />
                                Quitar
                              </button>
                            </form>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">Todavía no hay anotados.</p>
                )}
              </section>

              {/* lista de espera */}
              <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <h2 className="text-base font-semibold text-foreground">Lista de espera</h2>
                {waiting.length > 0 ? (
                  <ul className="mt-3 divide-y divide-border">
                    {waiting.map((w) => (
                      <li key={w.id} className="flex items-center justify-between gap-3 py-2.5">
                        <span className="inline-flex items-center gap-2 text-sm text-foreground">
                          <span className="flex size-5 items-center justify-center rounded-full bg-secondary text-[11px] font-medium text-muted-foreground">
                            {w.position}
                          </span>
                          {w.name}
                        </span>
                        {selFull ? (
                          <span className="text-xs text-muted-foreground">sin lugar</span>
                        ) : (
                          <form action={promoteWaitlist}>
                            <input type="hidden" name="waitlist" value={w.id} />
                            <input type="hidden" name="classId" value={id} />
                            <input type="hidden" name="occ" value={selected.id} />
                            <button
                              type="submit"
                              className="inline-flex min-h-11 items-center gap-1 rounded-md border border-primary px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/5"
                            >
                              <UserPlus className="size-3.5" aria-hidden />
                              Promover
                            </button>
                          </form>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">Nadie en lista de espera.</p>
                )}
              </section>

              {/* cancelar ocurrencia puntual */}
              <form action={cancelOccurrenceDetail}>
                <input type="hidden" name="classId" value={id} />
                <input type="hidden" name="occ" value={selected.id} />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/5 hover:text-destructive"
                >
                  <CalendarX className="size-4" aria-hidden />
                  Cancelar esta clase
                </button>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Cancela solo esta fecha y avisa a los anotados (devuelve el crédito si corresponde).
                </p>
              </form>
            </div>
          ) : null}
        </div>
      )}
    </main>
  );
}
