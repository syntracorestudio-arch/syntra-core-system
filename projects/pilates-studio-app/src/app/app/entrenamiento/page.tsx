import { redirect } from "next/navigation";
import {
  TrendingUp,
  Target,
  Flame,
  Trophy,
  Clock3,
  Sparkles,
  CalendarCheck,
} from "lucide-react";
import { createSupabaseServer } from "@/lib/supabase/server";
import { computeStreak, habitualSlot, weeklyCounts, localDateOf, WEEKDAY_LABEL } from "@/lib/streak";
import { RadialGauge } from "@/components/admin/radial-gauge";
import { Sparkline } from "@/components/admin/sparkline";
import { DonutChart, type DonutSlice } from "@/components/admin/donut-chart";
import { setMonthlyGoal } from "./actions";

export const metadata = { title: "Mi entrenamiento" };
export const dynamic = "force-dynamic";

const DEFAULT_TZ = "America/Argentina/Buenos_Aires";
const SLICE_COLORS = ["var(--primary)", "var(--warning)", "var(--success)", "var(--muted-foreground)"];
const WEEKS_SHOWN = 8;

type OccRel = {
  starts_at: string;
  class_id: string;
  classes: { name: string; duration_min: number | null } | { name: string; duration_min: number | null }[] | null;
};
type Row = { status: string; class_occurrences: OccRel | OccRel[] | null };

function monthKeyOf(iso: string, tz: string) {
  return localDateOf(iso, tz).slice(0, 7);
}
function monthName(key: string, style: "long" | "short" = "long") {
  const [y, m] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("es-AR", { timeZone: "UTC", month: style }).format(new Date(Date.UTC(y, m - 1, 15)));
}
function shiftMonth(key: string, delta: number) {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 15)).toISOString().slice(0, 7);
}

export default async function EntrenamientoPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; notice?: string; error?: string }>;
}) {
  const { mes, notice, error } = await searchParams;
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: member } = await supabase
    .from("members")
    .select("id, role, monthly_goal, studios(timezone)")
    .eq("profile_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!member) redirect("/login");
  const sRel = (member.studios ?? null) as { timezone: string | null } | { timezone: string | null }[] | null;
  const tz = (Array.isArray(sRel) ? sRel[0] : sRel)?.timezone || DEFAULT_TZ;
  const goal = (member.monthly_goal as number | null) ?? null;

  const now = new Date();
  const nowIso = now.toISOString();
  const yearAgoIso = new Date(now.getTime() - 370 * 86_400_000).toISOString();

  // Último año de reservas con su desenlace (RLS: propias). Una sola query.
  const { data: raw } = await supabase
    .from("class_reservations")
    .select("status, class_occurrences!inner(starts_at, class_id, classes(name, duration_min))")
    .gte("class_occurrences.starts_at", yearAgoIso)
    .lte("class_occurrences.starts_at", nowIso)
    .limit(600);

  const rows = ((raw ?? []) as Row[])
    .map((r) => {
      const o = (Array.isArray(r.class_occurrences) ? r.class_occurrences[0] : r.class_occurrences) ?? null;
      const c = o ? ((Array.isArray(o.classes) ? o.classes[0] : o.classes) ?? null) : null;
      return o
        ? {
            status: r.status,
            startsAt: o.starts_at,
            classId: o.class_id,
            className: c?.name ?? "Clase",
            duration: c?.duration_min ?? 60,
          }
        : null;
    })
    .filter(Boolean) as { status: string; startsAt: string; classId: string; className: string; duration: number }[];

  const attendedRows = rows.filter((r) => r.status === "attended");
  const attendedIsos = attendedRows.map((r) => r.startsAt);
  const streak = computeStreak(attendedIsos, tz, nowIso);
  const slot = habitualSlot(attendedRows, tz);

  // ── Clases por semana (con valor arriba de cada barra) ──
  const weekly = weeklyCounts(attendedIsos, tz, nowIso, WEEKS_SHOWN);
  const thisWeek = weekly[WEEKS_SHOWN - 1] ?? 0;
  const lastWeek = weekly[WEEKS_SHOWN - 2] ?? 0;
  const weekDelta = thisWeek - lastWeek;
  const maxWeekly = Math.max(...weekly, 1);

  // ── Meses ──
  const currentMonth = monthKeyOf(nowIso, tz);
  const byMonth = new Map<string, typeof attendedRows>();
  for (const r of attendedRows) {
    const k = monthKeyOf(r.startsAt, tz);
    byMonth.set(k, [...(byMonth.get(k) ?? []), r]);
  }
  const last6 = Array.from({ length: 6 }, (_, i) => shiftMonth(currentMonth, i - 5));
  const monthlySeries = last6.map((k) => (byMonth.get(k) ?? []).length);

  // Filtro: desplegable con los meses del año en curso (enero → mes actual)
  const yearKey = currentMonth.slice(0, 4);
  const monthsOfYear = Array.from({ length: Number(currentMonth.slice(5, 7)) }, (_, i) => {
    const mm = String(i + 1).padStart(2, "0");
    return `${yearKey}-${mm}`;
  }).reverse();
  const selMonth = mes && /^\d{4}-\d{2}$/.test(mes) && mes <= currentMonth ? mes : currentMonth;

  const selRows = rows.filter((r) => monthKeyOf(r.startsAt, tz) === selMonth);
  const selAttended = selRows.filter((r) => r.status === "attended");
  const selNoShow = selRows.filter((r) => r.status === "no_show").length;
  const selMarked = selAttended.length + selNoShow;
  const selPct = selMarked > 0 ? Math.round((selAttended.length / selMarked) * 100) : null;
  const selHours = Math.round(selAttended.reduce((a, r) => a + r.duration, 0) / 6) / 10;

  const byClass = new Map<string, number>();
  for (const r of selAttended) byClass.set(r.className, (byClass.get(r.className) ?? 0) + 1);
  const slices: DonutSlice[] = [...byClass.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([label, value], i) => ({ label, value, color: SLICE_COLORS[i % SLICE_COLORS.length] }));

  // ── Objetivo ──
  const attendedThisMonth = (byMonth.get(currentMonth) ?? []).length;
  const goalPct = goal ? Math.min(Math.round((attendedThisMonth / goal) * 100), 100) : 0;
  const goalDone = goal !== null && attendedThisMonth >= goal;

  // ── Año ──
  const yearRows = attendedRows.filter((r) => monthKeyOf(r.startsAt, tz).startsWith(yearKey));
  const yearHours = Math.round(yearRows.reduce((a, r) => a + r.duration, 0) / 6) / 10;
  const yearNoShows = rows.filter(
    (r) => r.status === "no_show" && monthKeyOf(r.startsAt, tz).startsWith(yearKey),
  ).length;
  const yearMarked = yearRows.length + yearNoShows;

  // ── Análisis en prosa ──
  const insights: string[] = [];
  const prevMonth = shiftMonth(currentMonth, -1);
  const prevCount = (byMonth.get(prevMonth) ?? []).length;
  if (attendedThisMonth > 0 || prevCount > 0) {
    insights.push(
      attendedThisMonth >= prevCount
        ? `Llevás ${attendedThisMonth} ${attendedThisMonth === 1 ? "clase" : "clases"} este mes — ${
            prevCount > 0 ? `vas camino a superar las ${prevCount} de ${monthName(prevMonth)}` : "arrancaste el mes en movimiento"
          }.`
        : `En ${monthName(prevMonth)} hiciste ${prevCount} ${prevCount === 1 ? "clase" : "clases"}; este mes vas por ${attendedThisMonth} — todavía estás a tiempo de alcanzarlo.`,
    );
  }
  const bestMonth = [...byMonth.entries()].sort((a, b) => b[1].length - a[1].length)[0];
  if (bestMonth && bestMonth[1].length >= 2) {
    insights.push(`Tu mejor mes del último año fue ${monthName(bestMonth[0])} con ${bestMonth[1].length} clases.`);
  }
  if (slot) {
    insights.push(
      `Tu franja más constante: ${slot.className} los ${WEEKDAY_LABEL[slot.weekday]} a las ${slot.time} (fuiste ${slot.count} veces).`,
    );
  }
  if (streak.best >= 2) {
    insights.push(
      streak.current === streak.best
        ? `Estás en tu mejor racha histórica: ${streak.best} semanas seguidas. No la cortes.`
        : `Tu récord es de ${streak.best} semanas seguidas; hoy vas por ${streak.current}.`,
    );
  }
  if (yearRows.length >= 3) {
    insights.push(
      `En ${yearKey} ya entrenaste ${yearHours} h en ${yearRows.length} clases${
        yearMarked > 0 && yearNoShows === 0
          ? " — con asistencia perfecta."
          : yearMarked > 0
            ? ` (asistencia del ${Math.round((yearRows.length / yearMarked) * 100)}%).`
            : "."
      }`,
    );
  }

  const hasData = rows.length > 0;
  const card =
    "rounded-2xl border border-border bg-card p-5 shadow-sm duration-500 animate-in fade-in slide-in-from-bottom-2 [animation-fill-mode:backwards]";

  return (
    <main className="mx-auto min-h-dvh w-full max-w-5xl px-5 pb-16 pt-8 lg:px-8">
      <header className="flex items-center justify-between gap-4 rounded-3xl border border-border bg-gradient-to-br from-accent/70 via-card to-card p-5 shadow-sm duration-500 animate-in fade-in slide-in-from-bottom-2 sm:p-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Mi entrenamiento</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {yearRows.length > 0
              ? `${yearRows.length} clases · ${yearHours} h entrenadas en ${yearKey}`
              : "Tu constancia, tu progreso y tus números."}
          </p>
        </div>
        <span className="hidden size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary-ink sm:flex">
          <TrendingUp className="size-5" aria-hidden />
        </span>
      </header>

      {notice ? (
        <p className="mt-5 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">{notice}</p>
      ) : null}
      {error ? (
        <p className="mt-5 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {!hasData ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border bg-card/60 px-6 py-12 text-center">
          <Sparkles className="mx-auto size-6 text-muted-foreground" aria-hidden />
          <p className="mt-3 text-sm text-muted-foreground">
            Cuando tomes tus primeras clases, acá va a aparecer tu seguimiento completo.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-12 lg:items-start">
          {/* ── columna izquierda ── */}
          <div className="grid gap-4 lg:col-span-7">
            {/* objetivo: gauge + meta tipeada por el alumno */}
            <section className={card}>
              <div className="flex flex-wrap items-center gap-5">
                <div className="relative">
                  <span className={goalDone ? "text-success" : "text-primary"}>
                    <RadialGauge pct={goal ? goalPct : 0} size={96} stroke={9} />
                  </span>
                  <span className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-lg font-bold tabular-nums text-foreground">
                      {attendedThisMonth}
                      {goal ? <span className="text-xs font-normal text-muted-foreground">/{goal}</span> : null}
                    </span>
                    <span className="text-[10px] text-muted-foreground">este mes</span>
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="flex items-center gap-1.5 text-base font-semibold text-foreground">
                    <Target className="size-4 text-primary" aria-hidden />
                    Tu objetivo del mes
                  </h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {goal === null
                      ? "Escribí cuántas clases querés hacer por mes y seguí tu avance acá."
                      : goalDone
                        ? "¡Objetivo cumplido! Lo que venga ahora es puro extra 🎉"
                        : `Te ${goal - attendedThisMonth === 1 ? "falta 1 clase" : `faltan ${goal - attendedThisMonth} clases`} para cumplirlo.`}
                  </p>
                  <form action={setMonthlyGoal} className="mt-2.5 flex flex-wrap items-center gap-2">
                    <label htmlFor="goal" className="text-xs text-muted-foreground">
                      Meta mensual
                    </label>
                    <input
                      id="goal"
                      name="goal"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={60}
                      defaultValue={goal ?? ""}
                      placeholder="8"
                      className="w-20 rounded-lg border border-border bg-card px-2.5 py-1.5 text-sm tabular-nums text-foreground"
                    />
                    <span className="text-xs text-muted-foreground">clases</span>
                    <button
                      type="submit"
                      className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                    >
                      Guardar
                    </button>
                  </form>
                </div>
              </div>
            </section>

            {/* mes en detalle: desplegable del año en curso + donut */}
            <section className={card} style={{ animationDelay: "80ms" }}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-foreground">Tu mes en detalle</h2>
                <form method="GET" className="flex items-center gap-2">
                  <label htmlFor="mes" className="sr-only">
                    Elegir mes
                  </label>
                  <select
                    id="mes"
                    name="mes"
                    defaultValue={selMonth}
                    className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-sm capitalize text-foreground"
                  >
                    {monthsOfYear.map((k) => (
                      <option key={k} value={k} className="capitalize">
                        {monthName(k)} {yearKey}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-secondary"
                  >
                    Ver
                  </button>
                </form>
              </div>

              {selRows.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  Sin clases en {monthName(selMonth)}. Elegí otro mes del desplegable.
                </p>
              ) : (
                <div className="mt-4 flex flex-wrap items-center gap-6">
                  <DonutChart
                    slices={slices}
                    size={116}
                    stroke={16}
                    centerValue={String(selAttended.length)}
                    centerLabel={selAttended.length === 1 ? "clase" : "clases"}
                  />
                  <div className="min-w-0 flex-1">
                    <ul className="grid gap-1.5">
                      {slices.map((s) => (
                        <li key={s.label} className="flex items-center gap-2 text-sm">
                          <span aria-hidden className="size-2.5 rounded-full" style={{ background: s.color }} />
                          <span className="min-w-0 flex-1 truncate text-foreground">{s.label}</span>
                          <span className="font-semibold tabular-nums text-foreground">{s.value}</span>
                        </li>
                      ))}
                    </ul>
                    <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
                      {selPct !== null ? (
                        <div className="flex items-center gap-1">
                          <CalendarCheck className="size-3.5" aria-hidden />
                          <dt>Asistencia</dt>
                          <dd className="font-semibold text-foreground">{selPct}%</dd>
                        </div>
                      ) : null}
                      <div>
                        <dt className="inline">Horas: </dt>
                        <dd className="inline font-semibold text-foreground">{selHours} h</dd>
                      </div>
                      {selNoShow > 0 ? (
                        <div>
                          <dt className="inline">Ausencias: </dt>
                          <dd className="inline font-semibold text-foreground">{selNoShow}</dd>
                        </div>
                      ) : null}
                    </dl>
                  </div>
                </div>
              )}
            </section>

            {/* análisis en prosa */}
            {insights.length > 0 ? (
              <section
                className="rounded-2xl border border-primary/20 bg-primary/5 p-5 duration-500 animate-in fade-in slide-in-from-bottom-2 [animation-fill-mode:backwards]"
                style={{ animationDelay: "160ms" }}
              >
                <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <Sparkles className="size-4 text-primary" aria-hidden />
                  Análisis de tu entrenamiento
                </h2>
                <ul className="mt-2 grid gap-1.5">
                  {insights.map((t, i) => (
                    <li key={i} className="flex gap-2 text-sm text-foreground">
                      <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-primary" />
                      {t}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>

          {/* ── columna derecha ── */}
          <div className="grid gap-4 lg:col-span-5">
            {/* clases por semana: barras con el número arriba */}
            <section className={card} style={{ animationDelay: "40ms" }}>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">Clases por semana</h2>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    weekDelta >= 0 ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
                  }`}
                >
                  {weekDelta >= 0 ? `+${weekDelta}` : weekDelta} vs semana pasada
                </span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">Últimas {WEEKS_SHOWN} semanas</p>
              <div className="mt-3 flex h-28 items-end gap-2">
                {weekly.map((v, i) => (
                  <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1 self-stretch">
                    <span className={`text-[11px] font-semibold tabular-nums ${v > 0 ? "text-foreground" : "text-muted-foreground/50"}`}>
                      {v}
                    </span>
                    <div
                      style={{ height: `${Math.max((v / maxWeekly) * 100, 5)}%`, animationDelay: `${i * 40}ms` }}
                      className={`w-full rounded-t duration-500 animate-in fade-in slide-in-from-bottom-2 [animation-fill-mode:backwards] ${
                        i === WEEKS_SHOWN - 1 ? "bg-primary" : v > 0 ? "bg-primary/45" : "bg-surface-sunken"
                      }`}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
                <span>hace {WEEKS_SHOWN} semanas</span>
                <span className="font-medium text-foreground">esta semana</span>
              </div>
            </section>

            {/* tendencia mensual: línea + valor de cada mes */}
            <section className={card} style={{ animationDelay: "120ms" }}>
              <h2 className="text-sm font-semibold text-foreground">Tendencia mensual</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Clases por mes, últimos 6 meses</p>
              <div className="mt-3 text-primary">
                <Sparkline data={monthlySeries} className="h-16 w-full" />
              </div>
              <div className="mt-2 grid grid-cols-6 text-center">
                {last6.map((k, i) => (
                  <div key={k}>
                    <p className="text-sm font-bold tabular-nums text-foreground">{monthlySeries[i]}</p>
                    <p className="text-[10px] capitalize text-muted-foreground">{monthName(k, "short").replace(".", "")}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* constancia */}
            <dl className="grid grid-cols-3 gap-3">
              {[
                { icon: Flame, label: "Racha", value: streak.current, suffix: streak.current === 1 ? "semana" : "semanas", hot: streak.current >= 2 },
                { icon: Trophy, label: "Tu récord", value: streak.best, suffix: streak.best === 1 ? "semana" : "semanas", hot: false },
                { icon: Clock3, label: `Horas ${yearKey}`, value: yearHours, suffix: "h", hot: false },
              ].map((s, i) => (
                <div
                  key={s.label}
                  style={{ animationDelay: `${160 + i * 60}ms` }}
                  className={`rounded-xl border px-3.5 py-3 shadow-sm duration-500 animate-in fade-in slide-in-from-bottom-2 [animation-fill-mode:backwards] ${
                    s.hot ? "border-primary/25 bg-primary/5" : "border-border bg-card"
                  }`}
                >
                  <dt className="flex items-center gap-1 text-xs text-muted-foreground">
                    <s.icon className={`size-3.5 ${s.hot ? "text-primary" : ""}`} aria-hidden />
                    {s.label}
                  </dt>
                  <dd className="mt-0.5 text-xl font-bold tabular-nums text-foreground">
                    {s.value}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">{s.suffix}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      )}
    </main>
  );
}
