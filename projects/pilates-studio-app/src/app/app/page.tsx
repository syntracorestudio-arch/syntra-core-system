import { redirect } from "next/navigation";
import { LogOut, CalendarDays } from "lucide-react";
import { createSupabaseServer } from "@/lib/supabase/server";
import { ClassCard, type ClassCardData } from "@/components/calendar/class-card";

export const metadata = { title: "Reservá tu clase" };
export const dynamic = "force-dynamic";

const DEFAULT_TZ = "America/Argentina/Buenos_Aires";

/** Parte una fecha ISO en (date YYYY-MM-DD, time HH:MM) según la zona horaria del estudio. */
function tzParts(iso: string, tz: string) {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const p = Object.fromEntries(dtf.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

function buildDayStrip(todayLocal: string) {
  const [y, m, d] = todayLocal.split("-").map(Number);
  return Array.from({ length: 7 }, (_, i) => {
    const dt = new Date(Date.UTC(y, m - 1, d + i, 12, 0, 0));
    const key = dt.toISOString().slice(0, 10);
    const weekday = new Intl.DateTimeFormat("es-AR", { timeZone: "UTC", weekday: "short" })
      .format(dt)
      .replace(".", "");
    const dayNum = new Intl.DateTimeFormat("es-AR", { timeZone: "UTC", day: "numeric" }).format(dt);
    return { key, weekday, dayNum, isToday: i === 0 };
  });
}

type StudioRel = { name: string; timezone: string | null; slug: string };

export default async function AppPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string; notice?: string; error?: string }>;
}) {
  const { day, notice, error } = await searchParams;
  const supabase = await createSupabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Vínculo + estudio (RLS: el alumno ve su propio member + su estudio)
  const { data: member } = await supabase
    .from("members")
    .select("role, studios(name, timezone, slug)")
    .limit(1)
    .maybeSingle();

  const studioRel = (member?.studios ?? null) as StudioRel | StudioRel[] | null;
  const studio = Array.isArray(studioRel) ? studioRel[0] : studioRel;
  const tz = studio?.timezone || DEFAULT_TZ;

  const now = new Date();
  const nowIso = now.toISOString();
  const endIso = new Date(now.getTime() + 8 * 86_400_000).toISOString();
  const todayDate = tzParts(nowIso, tz).date;

  // Saldo desde TABLAS BASE (respeta RLS; NO usamos la vista member_financial_status,
  // que es security-definer y filtraría mal / fugaría datos de otros alumnos).
  const { data: passes } = await supabase
    .from("member_passes")
    .select("id")
    .gt("expires_at", nowIso);
  const validPassIds = (passes ?? []).map((p) => p.id as string);
  let credits = 0;
  if (validPassIds.length > 0) {
    const { data: ledger } = await supabase
      .from("credit_ledger")
      .select("delta")
      .in("member_pass_id", validPassIds);
    credits = (ledger ?? []).reduce((s, l) => s + (l.delta as number), 0);
  }
  const { data: mships } = await supabase
    .from("memberships")
    .select("id")
    .eq("status", "active")
    .gte("valid_to", todayDate);
  const hasMembership = (mships ?? []).length > 0;

  // Ocurrencias de los próximos 8 días (RLS: las de mi estudio)
  const { data: occ } = await supabase
    .from("class_occurrences")
    .select("id, starts_at, capacity, booked_count, classes(name, instructor_name, duration_min)")
    .eq("status", "scheduled")
    .gte("starts_at", nowIso)
    .lt("starts_at", endIso)
    .order("starts_at", { ascending: true });

  // Mis reservas activas + mi waitlist (RLS: propias)
  const { data: myRes } = await supabase
    .from("class_reservations")
    .select("id, occurrence_id")
    .eq("status", "booked");
  const { data: myWait } = await supabase
    .from("waitlist")
    .select("occurrence_id")
    .eq("status", "waiting");
  const resByOcc = new Map((myRes ?? []).map((r) => [r.occurrence_id, r.id]));
  const waitingOcc = new Set((myWait ?? []).map((w) => w.occurrence_id));

  // Agrupar ocurrencias por día local
  const byDay = new Map<string, ClassCardData[]>();
  for (const o of occ ?? []) {
    const { date, time } = tzParts(o.starts_at as string, tz);
    const klass = (Array.isArray(o.classes) ? o.classes[0] : o.classes) as
      | { name: string; instructor_name: string | null; duration_min: number | null }
      | null;
    const card: ClassCardData = {
      occurrenceId: o.id as string,
      time,
      durationMin: klass?.duration_min ?? null,
      name: klass?.name ?? "Clase",
      instructor: klass?.instructor_name ?? null,
      capacity: o.capacity as number,
      booked: o.booked_count as number,
      myReservationId: resByOcc.get(o.id as string) ?? null,
      isWaiting: waitingOcc.has(o.id as string),
    };
    (byDay.get(date) ?? byDay.set(date, []).get(date)!).push(card);
  }

  const today = tzParts(nowIso, tz).date;
  const strip = buildDayStrip(today);
  const firstWithClasses = strip.find((d) => byDay.has(d.key))?.key;
  const selected =
    day && strip.some((d) => d.key === day) ? day : firstWithClasses ?? strip[0].key;
  const dayCards = byDay.get(selected) ?? [];

  const fullName = (user.user_metadata?.full_name as string | undefined) ?? user.email ?? "";
  const firstName = fullName.split(" ")[0] || "alumno/a";

  const saldoText = hasMembership
    ? "Abono activo"
    : credits > 0
      ? `Te quedan ${credits} ${credits === 1 ? "clase" : "clases"}`
      : "Sin créditos";

  const selLabel = new Intl.DateTimeFormat("es-AR", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(selected + "T12:00:00Z"));

  const weekTotal = (occ ?? []).length;
  const reservedCount = (myRes ?? []).length;

  return (
    <main className="mx-auto min-h-dvh w-full max-w-5xl px-5 pb-16 pt-8 lg:px-8">
      {/* header */}
      <header className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Hola, {firstName}</p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {studio?.name ?? "Tu estudio"}
          </h1>
        </div>
        <a
          href="/logout"
          aria-label="Cerrar sesión"
          className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-secondary"
        >
          <LogOut className="size-3.5" aria-hidden />
          Salir
        </a>
      </header>

      {/* avisos */}
      {notice ? (
        <p className="mt-5 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="mt-5 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        {/* resumen lateral (arriba en mobile, columna derecha en desktop) */}
        <aside className="order-1 grid gap-3 lg:order-2 lg:sticky lg:top-8">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <p className="text-xs text-muted-foreground">Tu saldo</p>
            <p
              className={`mt-1 text-2xl font-bold ${
                !hasMembership && credits === 0 ? "text-destructive" : "text-foreground"
              }`}
            >
              {saldoText}
            </p>
            {!hasMembership && credits === 0 ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Comprá un pack en tu estudio para reservar.
              </p>
            ) : null}
          </div>
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <p className="text-xs text-muted-foreground">Tu semana</p>
            <dl className="mt-2 grid gap-1.5 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Clases disponibles</dt>
                <dd className="font-semibold text-foreground">{weekTotal}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Tus reservas</dt>
                <dd className="font-semibold text-foreground">{reservedCount}</dd>
              </div>
            </dl>
          </div>
        </aside>

        {/* columna principal: selector de día + clases */}
        <div className="order-2 lg:order-1">
          {/* selector de día */}
          <nav className="-mx-5 px-5 lg:mx-0 lg:px-0">
            <ul className="no-scrollbar flex gap-2 overflow-x-auto sm:grid sm:grid-cols-7 sm:overflow-visible">
              {strip.map((d) => {
                const active = d.key === selected;
                const has = byDay.has(d.key);
                return (
                  <li key={d.key} className="shrink-0 sm:shrink">
                    <a
                      href={`/app?day=${d.key}`}
                      className={`flex w-14 flex-col items-center rounded-xl border px-3 py-2.5 transition-colors sm:w-full ${
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card text-foreground hover:bg-secondary"
                      }`}
                    >
                      <span className="text-[11px] capitalize">
                        {d.isToday ? "Hoy" : d.weekday}
                      </span>
                      <span className="text-base font-bold">{d.dayNum}</span>
                      <span
                        className={`mt-1 size-1.5 rounded-full ${
                          has
                            ? active
                              ? "bg-primary-foreground"
                              : "bg-primary"
                            : "bg-transparent"
                        }`}
                        aria-hidden
                      />
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* clases del día */}
          <section className="mt-6">
            <h2 className="text-base font-semibold capitalize text-foreground">{selLabel}</h2>
            <div className="mt-3 grid gap-3">
              {dayCards.length > 0 ? (
                dayCards.map((c) => (
                  <ClassCard
                    key={c.occurrenceId}
                    data={c}
                    day={selected}
                    showCreditHint={!hasMembership && credits > 0}
                  />
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-border bg-card/60 px-6 py-12 text-center">
                  <CalendarDays className="mx-auto size-6 text-muted-foreground" aria-hidden />
                  <p className="mt-3 text-sm text-muted-foreground">
                    No hay clases este día. Probá con otro.
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
