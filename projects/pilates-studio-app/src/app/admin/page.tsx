import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Wallet,
  AlertCircle,
  CalendarClock,
  TrendingUp,
  TrendingDown,
  CalendarPlus,
  ChevronRight,
  CheckCircle2,
  Clock4,
  Activity,
} from "lucide-react";
import { createSupabaseServer } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/page-header";
import { CountUp } from "@/components/admin/count-up";
import { IncomeAreaChart } from "@/components/admin/income-area-chart";

export const metadata = { title: "Resumen — Panel" };
export const dynamic = "force-dynamic";

const ADMIN_ROLES = ["admin", "reception"];
const DEFAULT_TZ = "America/Argentina/Buenos_Aires";
const EXPIRY_WARNING_DAYS = 14;
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_LABEL: Record<number, string> = { 1: "L", 2: "M", 3: "M", 4: "J", 5: "V", 6: "S", 0: "D" };
const DAY_FULL: Record<number, string> = { 1: "lun", 2: "mar", 3: "mié", 4: "jue", 5: "vie", 6: "sáb", 0: "dom" };

function tzDate(iso: string, tz: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(new Date(iso))
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}`;
}
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
function addDays(dateStr: string, n: number) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
function prevMonth(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}
function shiftYm(ym: string, months: number) {
  const [y, m] = ym.split("-").map(Number);
  const idx = y * 12 + (m - 1) + months;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
}
function shortMonth(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Intl.DateTimeFormat("es-AR", { month: "short", timeZone: "UTC" })
    .format(new Date(Date.UTC(y, m - 1, 1)))
    .replace(/\./g, "");
}
function money(n: number) {
  return `$${Math.round(n).toLocaleString("es-AR")}`;
}
function timeOf(iso: string, tz: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date(iso))
      .map((x) => [x.type, x.value]),
  );
  return `${p.hour}:${p.minute}`;
}

type ProfileRel = { full_name: string };

export default async function AdminDashboardPage() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: member } = await supabase
    .from("members")
    .select("role, studios(name, timezone)")
    .eq("profile_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!member || !ADMIN_ROLES.includes(member.role)) redirect("/app");
  const isReception = member.role === "reception";
  const studioRel = (member.studios ?? null) as { name: string; timezone: string | null } | { name: string; timezone: string | null }[] | null;
  const studio = Array.isArray(studioRel) ? studioRel[0] : studioRel;
  const tz = studio?.timezone || DEFAULT_TZ;

  const nowIso = new Date().toISOString();
  const todayLocal = tzDate(nowIso, tz);
  const thisYm = todayLocal.slice(0, 7);
  const monthStart = localToUtcISO(`${thisYm}-01`, "00:00", tz);
  const prevMonthStart = localToUtcISO(`${prevMonth(thisYm)}-01`, "00:00", tz);
  const todayStart = localToUtcISO(todayLocal, "00:00", tz);
  const tomorrowStart = localToUtcISO(addDays(todayLocal, 1), "00:00", tz);
  const weekEnd = localToUtcISO(addDays(todayLocal, 7), "00:00", tz);

  const [{ data: pays }, { data: mems }, { data: fins }, { data: mships }, { data: occ }] = await Promise.all([
    supabase.from("payments").select("amount, concept, paid_at").eq("status", "confirmed"),
    supabase.from("members").select("id, profiles(full_name)").eq("role", "client"),
    supabase.from("member_financial_status").select("member_id, financial_status"),
    supabase.from("memberships").select("valid_to, status").eq("status", "active"),
    supabase
      .from("class_occurrences")
      .select("starts_at, capacity, booked_count, classes(name)")
      .eq("status", "scheduled")
      .gte("starts_at", todayStart)
      .lt("starts_at", weekEnd)
      .order("starts_at", { ascending: true }),
  ]);

  // ---- ingresos + comparativa ----
  const payments = (pays ?? []) as { amount: number; concept: string; paid_at: string }[];
  const ingresosTotal = payments.reduce((s, p) => s + Number(p.amount), 0);
  const monthPays = payments.filter((p) => p.paid_at >= monthStart);
  const ingresosMes = monthPays.reduce((s, p) => s + Number(p.amount), 0);
  const ingresosPrevMes = payments
    .filter((p) => p.paid_at >= prevMonthStart && p.paid_at < monthStart)
    .reduce((s, p) => s + Number(p.amount), 0);
  const delta = ingresosPrevMes > 0 ? Math.round(((ingresosMes - ingresosPrevMes) / ingresosPrevMes) * 100) : null;
  const packsMes = monthPays.filter((p) => p.concept === "pack").length;
  const sueltasMes = monthPays.filter((p) => p.concept === "drop_in").length;

  // serie de ingresos por mes (últimos 6) para el área
  const incomeByMonth = new Map<string, number>();
  for (const p of payments) {
    const k = p.paid_at.slice(0, 7);
    incomeByMonth.set(k, (incomeByMonth.get(k) ?? 0) + Number(p.amount));
  }
  const incomeSeries = Array.from({ length: 6 }, (_, i) => {
    const ym = shiftYm(thisYm, -(5 - i));
    return { label: shortMonth(ym), value: incomeByMonth.get(ym) ?? 0 };
  });

  // ---- alumnos / deuda (solo clients) ----
  const nameById = new Map<string, string>(
    ((mems ?? []) as { id: string; profiles: ProfileRel | ProfileRel[] | null }[]).map((m) => {
      const prof = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
      return [m.id, prof?.full_name ?? "Alumno"];
    }),
  );
  const finList = ((fins ?? []) as { member_id: string; financial_status: string }[]).filter((f) => nameById.has(f.member_id));
  const debtors = finList.filter((f) => f.financial_status !== "al_dia");
  const alDia = finList.length - debtors.length;

  const limitDate = addDays(todayLocal, EXPIRY_WARNING_DAYS);
  const porVencer = ((mships ?? []) as { valid_to: string; status: string }[]).filter(
    (m) => m.valid_to >= todayLocal && m.valid_to <= limitDate,
  ).length;
  const needsAttention = debtors.length > 0 || porVencer > 0;

  // ---- ocupación: semana + heatmap día×hora + clases de hoy ----
  const occs = (occ ?? []) as { starts_at: string; capacity: number; booked_count: number; classes: { name: string } | { name: string }[] | null }[];
  const weekCap = occs.reduce((s, o) => s + o.capacity, 0);
  const weekBooked = occs.reduce((s, o) => s + o.booked_count, 0);
  const weekOcc = weekCap > 0 ? Math.round((weekBooked / weekCap) * 100) : 0;
  const todayOccs = occs
    .filter((o) => o.starts_at >= todayStart && o.starts_at < tomorrowStart)
    .map((o) => {
      const cls = Array.isArray(o.classes) ? o.classes[0] : o.classes;
      return { time: timeOf(o.starts_at, tz), name: cls?.name ?? "Clase", booked: o.booked_count, capacity: o.capacity };
    });

  // heatmap: (weekday × hora) → ocupación
  const slots = new Map<string, { booked: number; cap: number }>();
  const hoursSet = new Set<number>();
  for (const o of occs) {
    const dk = tzDate(o.starts_at, tz);
    const wd = new Date(`${dk}T12:00:00Z`).getUTCDay();
    const hh = Number(timeOf(o.starts_at, tz).slice(0, 2));
    hoursSet.add(hh);
    const key = `${wd}-${hh}`;
    const acc = slots.get(key) ?? { booked: 0, cap: 0 };
    acc.booked += o.booked_count;
    acc.cap += o.capacity;
    slots.set(key, acc);
  }
  const hours = [...hoursSet].sort((a, b) => a - b);

  const monthLabel = new Intl.DateTimeFormat("es-AR", { timeZone: tz, month: "long" }).format(new Date(nowIso));
  const isEmpty = payments.length === 0 && occs.length === 0;

  return (
    <main className="mx-auto min-h-dvh w-full max-w-6xl px-5 pb-16 pt-8 lg:px-8">
      <PageHeader title="Resumen" subtitle={studio?.name ?? "Tu estudio"} />

      {isEmpty ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border bg-card/60 px-6 py-14 text-center">
          <Wallet className="mx-auto size-7 text-primary" aria-hidden />
          <h2 className="mt-3 text-lg font-semibold text-foreground">Tu negocio, en una pantalla</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Cargá tus primeras clases y registrá un pago para ver acá tus ingresos, la ocupación y quién está al día.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link
              href="/admin/clases#nueva-clase"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:opacity-90"
            >
              <CalendarPlus className="size-4" aria-hidden />
              Crear una clase
            </Link>
            <Link
              href="/admin/alumnos"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
            >
              <Wallet className="size-4" aria-hidden />
              Registrar un pago
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-6 grid gap-5 duration-500 animate-in fade-in slide-in-from-bottom-2">
          {/* ══ KPIs ══ */}
          <div className={`grid grid-cols-2 gap-3 ${isReception ? "lg:grid-cols-3" : "lg:grid-cols-4"}`}>
            {!isReception ? (
              <Kpi
                icon={<TrendingUp className="size-4" aria-hidden />}
                label={`Ingresos de ${monthLabel}`}
                hero
              >
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <CountUp value={ingresosMes} prefix="$" className="text-2xl font-bold tabular-nums text-foreground" />
                  {delta !== null ? (
                    <span
                      className={`inline-flex items-center gap-0.5 text-xs font-semibold ${
                        delta >= 0 ? "text-primary" : "text-muted-foreground"
                      }`}
                    >
                      {delta >= 0 ? <TrendingUp className="size-3" aria-hidden /> : <TrendingDown className="size-3" aria-hidden />}
                      {delta >= 0 ? "+" : ""}
                      {delta}%
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {packsMes} {packsMes === 1 ? "pack" : "packs"} · {sueltasMes} {sueltasMes === 1 ? "suelta" : "sueltas"}
                </p>
              </Kpi>
            ) : null}

            <Kpi icon={<Activity className="size-4" aria-hidden />} label="Ocupación semana">
              <p className="text-2xl font-bold tabular-nums text-foreground">{weekOcc}%</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {weekBooked}/{weekCap} lugares
              </p>
            </Kpi>

            <Kpi icon={<CheckCircle2 className="size-4" aria-hidden />} label="Alumnos al día" tone="success">
              <p className="text-2xl font-bold tabular-nums text-foreground">{alDia}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">de {finList.length}</p>
            </Kpi>

            <Kpi
              icon={<AlertCircle className="size-4" aria-hidden />}
              label="Con deuda"
              tone={debtors.length > 0 ? "warning" : "muted"}
            >
              <p className={`text-2xl font-bold tabular-nums ${debtors.length > 0 ? "text-foreground" : "text-foreground"}`}>
                {debtors.length}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">a cobrar</p>
            </Kpi>
          </div>

          {/* ══ Ingresos (protagonista, solo admin) ══ */}
          {!isReception ? (
            <section className="rounded-2xl border border-border bg-card p-5 shadow-raised">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-base font-semibold text-foreground">Ingresos</h2>
                <span className="text-xs text-muted-foreground">
                  últimos 6 meses · total {money(ingresosTotal)}
                </span>
              </div>
              <div className="mt-4">
                <IncomeAreaChart data={incomeSeries} />
              </div>
            </section>
          ) : null}

          {/* ══ Necesita tu atención ══ */}
          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <h2 className="inline-flex items-center gap-1.5 text-base font-semibold text-foreground">
                {needsAttention ? (
                  <AlertCircle className="size-4 text-warning" aria-hidden />
                ) : (
                  <CheckCircle2 className="size-4 text-success" aria-hidden />
                )}
                Necesita tu atención
              </h2>
              <span className="text-xs text-muted-foreground">
                {alDia} al día{debtors.length > 0 ? ` · ${debtors.length} con deuda` : ""}
              </span>
            </div>

            {needsAttention ? (
              <div className="mt-4 grid gap-4 sm:grid-cols-2 sm:items-start">
                <div>
                  <p className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
                    <Wallet className="size-4 text-destructive" aria-hidden />
                    {debtors.length} {debtors.length === 1 ? "alumno con pago pendiente" : "alumnos con pago pendiente"}
                  </p>
                  {debtors.length > 0 ? (
                    <ul className="mt-2 divide-y divide-border">
                      {debtors.slice(0, 5).map((d) => (
                        <li key={d.member_id}>
                          <Link
                            href={`/admin/alumnos/${d.member_id}`}
                            className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-secondary"
                          >
                            <span className="truncate text-sm text-foreground">{nameById.get(d.member_id) ?? "Alumno"}</span>
                            <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary">
                              cobrar <ChevronRight className="size-3.5" aria-hidden />
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-sm text-muted-foreground">Nadie con deuda.</p>
                  )}
                  {debtors.length > 5 ? (
                    <Link href="/admin/alumnos" className="mt-2 inline-block text-xs font-medium text-primary hover:underline">
                      ver los {debtors.length}
                    </Link>
                  ) : null}
                </div>

                <div>
                  <p className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
                    <Clock4 className="size-4 text-warning" aria-hidden />
                    Vencimientos próximos
                  </p>
                  {porVencer > 0 ? (
                    <p className="mt-2 text-sm text-foreground">
                      {porVencer} {porVencer === 1 ? "membresía vence" : "membresías vencen"} en los próximos {EXPIRY_WARNING_DAYS} días.
                    </p>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">Sin vencimientos en {EXPIRY_WARNING_DAYS} días.</p>
                  )}
                  <Link
                    href="/admin/alumnos"
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:opacity-90"
                  >
                    <Wallet className="size-4" aria-hidden />
                    Registrar pago
                  </Link>
                </div>
              </div>
            ) : (
              <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-success">
                <CheckCircle2 className="size-4" aria-hidden />
                Todo al día · sin vencimientos próximos.
              </p>
            )}
          </section>

          {/* ══ Operación: heatmap ocupación + clases de hoy ══ */}
          <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
            <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-foreground">Ocupación por horario</h2>
                <span className="text-sm font-semibold text-foreground">{weekOcc}%</span>
              </div>
              <p className="text-xs text-muted-foreground">Próximos 7 días · cuándo se llenan tus clases</p>
              {hours.length > 0 ? (
                <div className="mt-4">
                  <div className="grid gap-1" style={{ gridTemplateColumns: "auto repeat(7, minmax(0, 1fr))" }}>
                    <span />
                    {DAY_ORDER.map((wd) => (
                      <span key={wd} className="text-center text-[10px] font-medium uppercase text-muted-foreground">
                        {DAY_LABEL[wd]}
                      </span>
                    ))}
                    {hours.map((hh) => (
                      <HeatRow key={hh} hh={hh} slots={slots} />
                    ))}
                  </div>
                  <div className="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground">
                    menos
                    {[12, 34, 56, 78, 100].map((a) => (
                      <span
                        key={a}
                        className="size-3 rounded-sm"
                        style={{ backgroundColor: `color-mix(in srgb, var(--primary) ${a}%, transparent)` }}
                      />
                    ))}
                    más
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">No hay clases programadas esta semana.</p>
              )}
            </section>

            <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="inline-flex items-center gap-1.5 text-base font-semibold text-foreground">
                  <CalendarClock className="size-4 text-muted-foreground" aria-hidden />
                  Clases de hoy
                </h2>
                <Link href="/admin/clases" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                  ver agenda <ChevronRight className="size-3.5" aria-hidden />
                </Link>
              </div>
              {todayOccs.length > 0 ? (
                <ul className="mt-3 divide-y divide-border">
                  {todayOccs.map((c, i) => {
                    const full = c.booked >= c.capacity;
                    return (
                      <li key={i} className="flex items-center justify-between gap-3 py-2.5">
                        <div className="flex items-baseline gap-3">
                          <span className="text-sm font-bold tabular-nums text-foreground">{c.time}</span>
                          <span className="text-sm text-foreground">{c.name}</span>
                        </div>
                        <span className={`text-xs font-medium ${full ? "text-destructive" : "text-muted-foreground"}`}>
                          {c.booked}/{c.capacity}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">No hay clases hoy.</p>
              )}
            </section>
          </div>
        </div>
      )}
    </main>
  );
}

function Kpi({
  icon,
  label,
  tone = "primary",
  hero = false,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  tone?: "primary" | "success" | "warning" | "muted";
  hero?: boolean;
  children: React.ReactNode;
}) {
  const chip =
    tone === "success"
      ? "bg-success/15 text-success"
      : tone === "warning"
        ? "bg-warning/15 text-warning"
        : tone === "muted"
          ? "bg-secondary text-muted-foreground"
          : "bg-primary/10 text-primary";
  return (
    <div
      className={`rounded-2xl border border-border p-4 shadow-sm ${
        hero ? "bg-gradient-to-br from-primary/10 via-card to-card sm:col-span-2 lg:col-span-1" : "bg-card"
      }`}
    >
      <p className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <span className={`flex size-6 items-center justify-center rounded-md ${chip}`}>{icon}</span>
        {label}
      </p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function HeatRow({ hh, slots }: { hh: number; slots: Map<string, { booked: number; cap: number }> }) {
  return (
    <>
      <span className="pr-1 text-right text-[10px] tabular-nums text-muted-foreground">{String(hh).padStart(2, "0")}h</span>
      {DAY_ORDER.map((wd) => {
        const s = slots.get(`${wd}-${hh}`);
        if (!s || s.cap === 0) {
          return <span key={wd} className="h-6 rounded-sm bg-surface-sunken" aria-hidden />;
        }
        const pct = Math.round((s.booked / s.cap) * 100);
        const alpha = 14 + Math.round((pct / 100) * 86);
        return (
          <span
            key={wd}
            title={`${DAY_FULL[wd]} ${String(hh).padStart(2, "0")}h · ${s.booked}/${s.cap} (${pct}%)`}
            className="h-6 rounded-sm"
            style={{ backgroundColor: `color-mix(in srgb, var(--primary) ${alpha}%, transparent)` }}
          />
        );
      })}
    </>
  );
}
