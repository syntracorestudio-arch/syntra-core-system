import { redirect } from "next/navigation";
import { CalendarDays, Wallet, AlertCircle, Sparkles, Flame, Clock3 } from "lucide-react";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ClassCard, type ClassCardData } from "@/components/calendar/class-card";
import { buttonClass } from "@/components/ui/button";
import { RoleHero } from "@/components/shell/role-hero";
import { computeStreak, habitualSlot, WEEKDAY_LABEL, localDateOf } from "@/lib/streak";
import { reserve } from "./actions";

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

  // Nudge de recompra: pack por vencer en < 5 días (solo si le queda saldo)
  const expiresSoon =
    credits > 0 && nearestExpiry ? new Date(nearestExpiry).getTime() - now.getTime() < 5 * 86_400_000 : false;
  const expiryLabel = nearestExpiry
    ? new Intl.DateTimeFormat("es-AR", { timeZone: tz, day: "numeric", month: "long" }).format(new Date(nearestExpiry))
    : "";

  // Ocurrencias de los próximos 8 días (RLS: las de mi estudio)
  const { data: occ } = await supabase
    .from("class_occurrences")
    .select("id, class_id, starts_at, capacity, booked_count, classes(name, instructor_name, duration_min)")
    .eq("status", "scheduled")
    .gte("starts_at", nowIso)
    .lt("starts_at", endIso)
    .order("starts_at", { ascending: true });

  // Cuántos esperan por clase (RPC 027, solo números): expectativa honesta en llenas
  // y "puesto N de M" cuando ya está anotado.
  const waitCountByOcc = new Map<string, number>();
  if ((occ ?? []).length > 0) {
    const { data: wc } = await supabase.rpc("waitlist_counts", {
      p_occurrence_ids: (occ ?? []).map((o) => o.id as string),
    });
    for (const w of (wc ?? []) as { occurrence_id: string; waiting_count: number }[]) {
      waitCountByOcc.set(w.occurrence_id, w.waiting_count);
    }
  }

  // Asistencias pasadas → racha + "tu horario" (la franja que más repite; RLS propias)
  const { data: attendedRaw } = await supabase
    .from("class_reservations")
    .select("class_occurrences(class_id, starts_at, classes(name))")
    .eq("status", "attended")
    .order("created_at", { ascending: false })
    .limit(200);
  type AttRel = {
    class_id: string;
    starts_at: string;
    classes: { name: string } | { name: string }[] | null;
  };
  const attendedRows = ((attendedRaw ?? []) as { class_occurrences: AttRel | AttRel[] | null }[])
    .map((r) => (Array.isArray(r.class_occurrences) ? r.class_occurrences[0] : r.class_occurrences))
    .filter((o): o is AttRel => Boolean(o))
    .map((o) => ({
      classId: o.class_id,
      className: (Array.isArray(o.classes) ? o.classes[0] : o.classes)?.name ?? "Clase",
      startsAt: o.starts_at,
    }));
  const streak = computeStreak(attendedRows.map((r) => r.startsAt), tz, nowIso);
  const habitual = habitualSlot(attendedRows, tz);

  // Mis reservas activas + mi waitlist (RLS: propias)
  const { data: myRes } = await supabase
    .from("class_reservations")
    .select("id, occurrence_id, promoted")
    .eq("status", "booked");
  const { data: myWait } = await supabase
    .from("waitlist")
    .select("occurrence_id, position")
    .eq("status", "waiting");
  const resByOcc = new Map((myRes ?? []).map((r) => [r.occurrence_id, r.id]));
  const promotedByOcc = new Set(
    ((myRes ?? []) as { occurrence_id: string; promoted: boolean | null }[])
      .filter((r) => r.promoted)
      .map((r) => r.occurrence_id),
  );
  const waitPosByOcc = new Map(
    ((myWait ?? []) as { occurrence_id: string; position: number }[]).map((w) => [w.occurrence_id, w.position]),
  );

  // Próxima ocurrencia de "tu horario" con lugar y sin reserva mía → reservar en 1 toque
  const habitualNext = habitual
    ? ((occ ?? []) as { id: string; class_id: string; starts_at: string; capacity: number; booked_count: number }[]).find(
        (o) => {
          if (o.class_id !== habitual.classId) return false;
          if (resByOcc.has(o.id) || waitPosByOcc.has(o.id)) return false;
          if (o.booked_count >= o.capacity) return false;
          const local = tzParts(o.starts_at, tz);
          const wd = new Date(`${local.date}T12:00:00Z`).getUTCDay();
          return wd === habitual.weekday && local.time === habitual.time;
        },
      ) ?? null
    : null;
  const habitualNextLabel = habitualNext
    ? new Intl.DateTimeFormat("es-AR", { timeZone: tz, weekday: "long", day: "numeric" }).format(
        new Date(habitualNext.starts_at),
      )
    : null;

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

  // Agrupar ocurrencias por día local
  const byDay = new Map<string, ClassCardData[]>();
  for (const o of occ ?? []) {
    const { date, time } = tzParts(o.starts_at as string, tz);
    const klass = (Array.isArray(o.classes) ? o.classes[0] : o.classes) as
      | { name: string; instructor_name: string | null; duration_min: number | null }
      | null;
    const myResId = resByOcc.get(o.id as string) ?? null;
    // Deadline de cancelación sin costo (solo para MIS reservas). Las promovidas
    // desde la lista de espera devuelven el crédito hasta el inicio de la clase.
    let cancelHint: string | null = null;
    if (myResId) {
      if (promotedByOcc.has(o.id as string)) {
        cancelHint = "Te promovimos de la lista: cancelás sin costo hasta el inicio";
      } else {
        const deadline = new Date(new Date(o.starts_at as string).getTime() - windowH * 3600_000);
        cancelHint =
          deadline.toISOString() > nowIso
            ? `Cancelás sin costo hasta ${fmtDeadline(deadline.toISOString())}`
            : refundLate
              ? null
              : "Fuera de ventana: si cancelás no se devuelve el crédito";
      }
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
      waitingCount: waitCountByOcc.get(o.id as string) ?? 0,
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

  const saldoChip = hasMembership
    ? "Abono activo"
    : credits === 1
      ? "1 clase"
      : `${credits} clases`;

  const selLabel = new Intl.DateTimeFormat("es-AR", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(selected + "T12:00:00Z"));

  return (
    <main className="mx-auto min-h-dvh w-full max-w-3xl px-5 pb-16 pt-8 lg:px-8">
      {/* hero con la foto del estudio — mismo patrón aprobado del panel */}
      <RoleHero kicker={`Hola, ${firstName} · ${todayLabel}`} title={studio?.name ?? "Tu estudio"}>
        {/* racha: constancia visible sin invadir (solo con 2+ semanas al hilo) */}
        {streak.current >= 2 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary-ink">
            <Flame className="size-3.5" aria-hidden />
            {streak.current} semanas al hilo
          </span>
        ) : null}
        {/* saldo a mano en mobile (en desktop vive en el sidebar) */}
        <a
          href="/app/comprar"
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors lg:hidden ${
            !hasMembership && credits === 0
              ? "border-warning/40 bg-warning/10 text-foreground"
              : "border-border bg-card/90 text-foreground backdrop-blur hover:bg-secondary"
          }`}
        >
          <Sparkles className="size-3.5 text-primary" aria-hidden />
          {saldoChip}
        </a>
      </RoleHero>

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

      {/* Nudge de recompra: solo lo que el saldo del shell NO dice ya (saldo al límite o
          pack por vencer). Con saldo 0 el widget "Sin créditos" + su CTA cubren el caso. */}
      {!hasMembership && credits > 0 && (credits === 1 || expiresSoon) ? (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3">
          <p className="flex items-center gap-2 text-sm text-foreground">
            <AlertCircle className="size-4 shrink-0 text-warning" aria-hidden />
            {credits === 1
              ? `Te queda 1 clase.${expiresSoon ? ` Y tu pack vence el ${expiryLabel}.` : ""}`
              : `Tu pack vence el ${expiryLabel} — te quedan ${credits} clases.`}
          </p>
          <a href="/app/comprar" className={buttonClass("primary", "sm")}>
            <Wallet className="size-4" aria-hidden />
            Comprar
          </a>
        </div>
      ) : null}

      {/* "tu horario": la franja que más repite, con lugar → reservar sin buscar */}
      {habitualNext && habitual && (hasMembership || credits > 0) ? (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 duration-500 animate-in fade-in slide-in-from-bottom-2">
          <p className="flex items-center gap-2 text-sm text-foreground">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Clock3 className="size-4" aria-hidden />
            </span>
            <span>
              <span className="font-semibold">Tu horario:</span> {habitual.className} · {WEEKDAY_LABEL[habitual.weekday]}{" "}
              {habitual.time}
            </span>
          </p>
          <form action={reserve}>
            <input type="hidden" name="occ" value={habitualNext.id} />
            <input type="hidden" name="day" value={localDateOf(habitualNext.starts_at, tz)} />
            <button type="submit" className={buttonClass("primary", "sm")}>
              Reservar el {habitualNextLabel}
            </button>
          </form>
        </div>
      ) : null}

      {/* selector de día — protagonista, full width */}
      <nav className="-mx-5 mt-6 px-5 lg:mx-0 lg:px-0">
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
            dayCards.map((c, i) => (
              <div
                key={c.occurrenceId}
                style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
                className="duration-500 animate-in fade-in slide-in-from-bottom-2 [animation-fill-mode:backwards]"
              >
                <ClassCard data={c} day={selected} showCreditHint={!hasMembership && credits > 0} />
              </div>
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
    </main>
  );
}
