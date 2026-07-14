import { redirect } from "next/navigation";
import { LogOut, CalendarDays, LayoutGrid, Wallet, CalendarCheck, Sparkles, UserRound } from "lucide-react";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ClassCard, type ClassCardData } from "@/components/calendar/class-card";
import { buttonClass } from "@/components/ui/button";
import { SuspendedScreen } from "@/components/suspended-screen";

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

type StudioRel = { name: string; timezone: string | null; slug: string; status: string };

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
    .select("role, studio_id, studios(name, timezone, slug, status)")
    .eq("profile_id", user.id)
    .limit(1)
    .maybeSingle();

  const studioRel = (member?.studios ?? null) as StudioRel | StudioRel[] | null;
  const studio = Array.isArray(studioRel) ? studioRel[0] : studioRel;
  const tz = studio?.timezone || DEFAULT_TZ;
  const isStaff = member?.role === "admin" || member?.role === "reception";

  // Estudio suspendido (Fase 5): la app del alumno queda en pausa.
  if (studio?.status === "suspended") {
    return <SuspendedScreen studioName={studio.name} audience="member" />;
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const endIso = new Date(now.getTime() + 8 * 86_400_000).toISOString();
  const todayDate = tzParts(nowIso, tz).date;

  // Saldo desde TABLAS BASE (respeta RLS; NO usamos la vista member_financial_status,
  // que es security-definer y filtraría mal / fugaría datos de otros alumnos).
  const { data: passes } = await supabase
    .from("member_passes")
    .select("id, expires_at")
    .gt("expires_at", nowIso);
  const validPasses = (passes ?? []) as { id: string; expires_at: string }[];
  const validPassIds = validPasses.map((p) => p.id);
  let credits = 0;
  let nearestExpiry: string | null = null;
  if (validPassIds.length > 0) {
    const { data: ledger } = await supabase
      .from("credit_ledger")
      .select("delta, member_pass_id")
      .in("member_pass_id", validPassIds);
    const byPass = new Map<string, number>();
    for (const l of (ledger ?? []) as { delta: number; member_pass_id: string }[]) {
      byPass.set(l.member_pass_id, (byPass.get(l.member_pass_id) ?? 0) + l.delta);
      credits += l.delta;
    }
    // vencimiento más próximo entre los passes que aún tienen saldo
    nearestExpiry =
      validPasses
        .filter((p) => (byPass.get(p.id) ?? 0) > 0)
        .map((p) => p.expires_at)
        .sort()[0] ?? null;
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
    .select("occurrence_id, position")
    .eq("status", "waiting");
  const resByOcc = new Map((myRes ?? []).map((r) => [r.occurrence_id, r.id]));
  const waitPosByOcc = new Map(
    ((myWait ?? []) as { occurrence_id: string; position: number }[]).map((w) => [w.occurrence_id, w.position]),
  );

  // Política de cancelación del estudio (el alumno no lee settings por RLS → server).
  const adminDb = createAdminClient();
  const { data: st } = await adminDb
    .from("studio_settings")
    .select("cancellation_window_hours, refund_on_late_cancel")
    .eq("studio_id", (member as { studio_id?: string } | null)?.studio_id ?? "")
    .maybeSingle();
  const windowH = (st?.cancellation_window_hours as number | undefined) ?? 24;
  const refundLate = Boolean(st?.refund_on_late_cancel);
  const fmtDeadline = (iso: string) =>
    new Intl.DateTimeFormat("es-AR", { timeZone: tz, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .format(new Date(iso))
      .replace(/\./g, "");

  // Próxima clase reservada (occ viene ordenado por starts_at asc)
  const nextBookedOcc = (occ ?? []).find((o) => resByOcc.has(o.id as string));
  const nextBooked = nextBookedOcc
    ? (() => {
        const { date, time } = tzParts(nextBookedOcc.starts_at as string, tz);
        const klass = (Array.isArray(nextBookedOcc.classes) ? nextBookedOcc.classes[0] : nextBookedOcc.classes) as
          | { name: string; instructor_name: string | null }
          | null;
        const todayKey = tzParts(new Date().toISOString(), tz).date;
        const dayLabel =
          date === todayKey
            ? "Hoy"
            : new Intl.DateTimeFormat("es-AR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(
                new Date(`${date}T12:00:00Z`),
              );
        return { dayLabel, time, name: klass?.name ?? "Clase", instructor: klass?.instructor_name ?? null };
      })()
    : null;

  // Agrupar ocurrencias por día local
  const byDay = new Map<string, ClassCardData[]>();
  for (const o of occ ?? []) {
    const { date, time } = tzParts(o.starts_at as string, tz);
    const klass = (Array.isArray(o.classes) ? o.classes[0] : o.classes) as
      | { name: string; instructor_name: string | null; duration_min: number | null }
      | null;
    const myResId = resByOcc.get(o.id as string) ?? null;
    // Deadline de cancelación sin costo (solo para MIS reservas)
    let cancelHint: string | null = null;
    if (myResId) {
      const deadline = new Date(new Date(o.starts_at as string).getTime() - windowH * 3600_000);
      cancelHint =
        deadline.toISOString() > nowIso
          ? `Cancelás sin costo hasta ${fmtDeadline(deadline.toISOString())}`
          : refundLate
            ? null
            : "Fuera de ventana: si cancelás no se devuelve el crédito";
    }
    const card: ClassCardData = {
      occurrenceId: o.id as string,
      time,
      durationMin: klass?.duration_min ?? null,
      name: klass?.name ?? "Clase",
      instructor: klass?.instructor_name ?? null,
      capacity: o.capacity as number,
      booked: o.booked_count as number,
      myReservationId: myResId,
      isWaiting: waitPosByOcc.has(o.id as string),
      waitPosition: waitPosByOcc.get(o.id as string) ?? null,
      cancelHint,
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
  const todayLabel = new Intl.DateTimeFormat("es-AR", {
    timeZone: tz,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(now);

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
    <main className="canvas-aurora mx-auto min-h-dvh w-full max-w-5xl px-5 pb-16 pt-8 lg:px-8">
      {/* header — banda cálida que ancla la página */}
      <header className="flex items-center justify-between gap-4 rounded-3xl border border-border bg-gradient-to-br from-accent/70 via-card to-card p-5 shadow-sm sm:p-6">
        <div>
          <p className="text-sm text-muted-foreground">
            Hola, {firstName} · {todayLabel}
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {studio?.name ?? "Tu estudio"}
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {isStaff ? (
            <a
              href="/admin"
              className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
            >
              <LayoutGrid className="size-3.5" aria-hidden />
              Panel
            </a>
          ) : null}
          <a
            href="/cuenta"
            aria-label="Mi cuenta"
            className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-secondary"
          >
            <UserRound className="size-3.5" aria-hidden />
            <span className="hidden sm:inline">Mi cuenta</span>
          </a>
          <a
            href="/logout"
            aria-label="Cerrar sesión"
            className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-secondary"
          >
            <LogOut className="size-3.5" aria-hidden />
            Salir
          </a>
        </div>
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
          {/* saldo = héroe del aside */}
          <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-card to-card p-5 shadow-raised">
            <p className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <span className="flex size-7 items-center justify-center rounded-full bg-primary/15 text-primary">
                <Sparkles className="size-3.5" aria-hidden />
              </span>
              Tu saldo
            </p>
            <p
              className={`mt-2 text-2xl font-bold ${
                !hasMembership && credits === 0 ? "text-destructive" : "text-foreground"
              }`}
            >
              {saldoText}
            </p>
            {!hasMembership && credits > 0 && nearestExpiry ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Vencen el{" "}
                {new Intl.DateTimeFormat("es-AR", { timeZone: tz, day: "numeric", month: "long" }).format(
                  new Date(nearestExpiry),
                )}
                .
              </p>
            ) : null}
            {!hasMembership && credits === 0 ? (
              <p className="mt-1 text-xs text-muted-foreground">Comprá un pack para empezar a reservar.</p>
            ) : null}
            <a href="/app/comprar" className={buttonClass("primary", "sm", "mt-3 w-full")}>
              <Wallet className="size-4" aria-hidden />
              Comprar
            </a>
          </div>

          {/* próxima clase reservada */}
          {nextBooked ? (
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <p className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <span className="flex size-7 items-center justify-center rounded-full bg-success/15 text-success">
                  <CalendarCheck className="size-3.5" aria-hidden />
                </span>
                Tu próxima clase
              </p>
              <p className="mt-2 text-lg font-bold text-foreground">
                {nextBooked.name} · {nextBooked.time}
              </p>
              <p className="text-sm text-muted-foreground">
                {nextBooked.dayLabel.charAt(0).toUpperCase() + nextBooked.dayLabel.slice(1)}
              </p>
              {nextBooked.instructor ? (
                <p className="mt-0.5 text-xs text-muted-foreground">con {nextBooked.instructor}</p>
              ) : null}
            </div>
          ) : null}

          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <p className="text-xs font-medium text-muted-foreground">Tu semana</p>
            <dl className="mt-2 grid gap-1.5 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Clases disponibles</dt>
                <dd className="font-semibold tabular-nums text-foreground">{weekTotal}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Tus reservas</dt>
                <dd className="font-semibold tabular-nums text-foreground">{reservedCount}</dd>
              </div>
            </dl>
            <a
              href="/app/historial"
              className="mt-3 inline-block text-xs font-semibold text-primary-ink hover:underline"
            >
              ver mi historial →
            </a>
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
