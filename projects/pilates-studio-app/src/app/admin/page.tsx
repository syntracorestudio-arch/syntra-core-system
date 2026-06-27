import Link from "next/link";
import { redirect } from "next/navigation";
import {
  LogOut,
  Wallet,
  AlertCircle,
  CalendarClock,
  TrendingUp,
  CalendarPlus,
  ChevronRight,
  CheckCircle2,
} from "lucide-react";
import { createSupabaseServer } from "@/lib/supabase/server";
import { AdminTabs } from "@/components/admin/admin-tabs";
import { Sparkline } from "@/components/admin/sparkline";
import { CountUp } from "@/components/admin/count-up";

export const metadata = { title: "Resumen — Panel" };
export const dynamic = "force-dynamic";

const ADMIN_ROLES = ["admin", "reception"];
const DEFAULT_TZ = "America/Argentina/Buenos_Aires";
const EXPIRY_WARNING_DAYS = 14;

function tzDate(iso: string, tz: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(new Date(iso))
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}`;
}
/** Hora local del estudio (YYYY-MM-DD + HH:MM en tz) → instante UTC ISO (DST-safe). */
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
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
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
    .limit(1)
    .maybeSingle();
  if (!member || !ADMIN_ROLES.includes(member.role)) redirect("/app");
  const studioRel = (member.studios ?? null) as { name: string; timezone: string | null } | { name: string; timezone: string | null }[] | null;
  const studio = Array.isArray(studioRel) ? studioRel[0] : studioRel;
  const tz = studio?.timezone || DEFAULT_TZ;

  const nowIso = new Date().toISOString();
  const todayLocal = tzDate(nowIso, tz);
  const monthStart = localToUtcISO(`${todayLocal.slice(0, 7)}-01`, "00:00", tz);
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

  // ---- ingresos ----
  const payments = (pays ?? []) as { amount: number; concept: string; paid_at: string }[];
  const ingresosTotal = payments.reduce((s, p) => s + Number(p.amount), 0);
  const monthPays = payments.filter((p) => p.paid_at >= monthStart);
  const ingresosMes = monthPays.reduce((s, p) => s + Number(p.amount), 0);
  const packsMes = monthPays.filter((p) => p.concept === "pack").length;
  const sueltasMes = monthPays.filter((p) => p.concept === "drop_in").length;

  // ---- alumnos / deuda ----
  const nameById = new Map<string, string>(
    ((mems ?? []) as { id: string; profiles: ProfileRel | ProfileRel[] | null }[]).map((m) => {
      const prof = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
      return [m.id, prof?.full_name ?? "Alumno"];
    }),
  );
  const finList = (fins ?? []) as { member_id: string; financial_status: string }[];
  const debtors = finList.filter((f) => f.financial_status !== "al_dia");
  const alDia = finList.length - debtors.length;

  // ---- membresías por vencer ----
  const limitDate = addDays(todayLocal, EXPIRY_WARNING_DAYS);
  const porVencer = ((mships ?? []) as { valid_to: string; status: string }[]).filter(
    (m) => m.valid_to >= todayLocal && m.valid_to <= limitDate,
  ).length;

  // ---- ocupación ----
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

  // ingresos por mes (sparkline, últimos 6 meses)
  const incomeByMonth = new Map<string, number>();
  for (const p of payments) {
    const k = p.paid_at.slice(0, 7);
    incomeByMonth.set(k, (incomeByMonth.get(k) ?? 0) + Number(p.amount));
  }
  const ref = new Date(nowIso);
  const monthlyIncome = Array.from({ length: 6 }, (_, i) => {
    const dt = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() - (5 - i), 1));
    return incomeByMonth.get(dt.toISOString().slice(0, 7)) ?? 0;
  });

  // ocupación por día (próximos 7 días) → mini-barras
  const perDay = Array.from({ length: 7 }, (_, i) => {
    const dk = addDays(todayLocal, i);
    let cap = 0;
    let booked = 0;
    for (const o of occs) {
      if (tzDate(o.starts_at, tz) === dk) {
        cap += o.capacity;
        booked += o.booked_count;
      }
    }
    const label = new Intl.DateTimeFormat("es-AR", { timeZone: "UTC", weekday: "narrow" }).format(
      new Date(`${dk}T12:00:00Z`),
    );
    return { label, pct: cap > 0 ? Math.round((booked / cap) * 100) : 0, today: i === 0 };
  });

  const monthLabel = new Intl.DateTimeFormat("es-AR", { timeZone: tz, month: "long" }).format(new Date(nowIso));
  const isEmpty = payments.length === 0 && occs.length === 0;

  return (
    <main className="mx-auto min-h-dvh w-full max-w-6xl px-5 pb-16 pt-8 lg:px-8">
      <header className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{studio?.name ?? "Tu estudio"}</p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Resumen</h1>
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

      <AdminTabs active="resumen" />

      {isEmpty ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border bg-card/60 px-6 py-14 text-center">
          <Wallet className="mx-auto size-7 text-primary" aria-hidden />
          <h2 className="mt-3 text-lg font-semibold text-foreground">Tu negocio, en una pantalla</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Cargá tus primeras clases y registrá un pago para ver acá tus ingresos, la ocupación y quién
            está al día.
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
        <div className="mt-6 grid gap-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
          {/* KPIs */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* ingresos del mes (héroe con degradé cálido + sparkline) */}
            <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-card to-card p-5 shadow-raised sm:col-span-2">
              <p className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <TrendingUp className="size-3.5 text-primary" aria-hidden />
                Ingresos de <span className="capitalize">{monthLabel}</span>
              </p>
              <CountUp
                value={ingresosMes}
                prefix="$"
                className="mt-1 block text-4xl font-bold tracking-tight text-foreground tabular-nums"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {packsMes} {packsMes === 1 ? "pack" : "packs"} · {sueltasMes}{" "}
                {sueltasMes === 1 ? "suelta" : "sueltas"} · total {money(ingresosTotal)}
              </p>
              <div className="mt-3 text-primary">
                <Sparkline data={monthlyIncome} className="h-12 w-full" />
              </div>
            </div>
            {/* al día */}
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <span className="flex size-9 items-center justify-center rounded-full bg-success/15 text-success">
                <CheckCircle2 className="size-5" aria-hidden />
              </span>
              <p className="mt-3 text-3xl font-bold text-foreground">{alDia}</p>
              <p className="text-xs text-muted-foreground">al día</p>
            </div>
            {/* con pago pendiente */}
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <span
                className={`flex size-9 items-center justify-center rounded-full ${
                  debtors.length > 0 ? "bg-destructive/15 text-destructive" : "bg-secondary text-muted-foreground"
                }`}
              >
                <AlertCircle className="size-5" aria-hidden />
              </span>
              <p className={`mt-3 text-3xl font-bold ${debtors.length > 0 ? "text-destructive" : "text-foreground"}`}>
                {debtors.length}
              </p>
              <p className="text-xs text-muted-foreground">con pago pendiente</p>
            </div>
          </div>

          {/* acciones rápidas */}
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/alumnos"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:opacity-90"
            >
              <Wallet className="size-4" aria-hidden />
              Registrar pago
            </Link>
            <Link
              href="/admin/clases#nueva-clase"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
            >
              <CalendarPlus className="size-4" aria-hidden />
              Nueva clase
            </Link>
          </div>

          <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
            {/* alertas: deuda + por vencer */}
            <div className="grid gap-4">
              <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <h2 className="text-base font-semibold text-foreground">Alumnos con pago pendiente</h2>
                {debtors.length > 0 ? (
                  <ul className="mt-3 divide-y divide-border">
                    {debtors.slice(0, 6).map((d) => (
                      <li key={d.member_id}>
                        <Link
                          href={`/admin/alumnos/${d.member_id}`}
                          className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-secondary"
                        >
                          <span className="truncate text-sm font-medium text-foreground">
                            {nameById.get(d.member_id) ?? "Alumno"}
                          </span>
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            ver ficha <ChevronRight className="size-3.5" aria-hidden />
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-success">
                    <CheckCircle2 className="size-4" aria-hidden />
                    Todos al día.
                  </p>
                )}
              </section>

              <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-base font-semibold text-foreground">Membresías por vencer</h2>
                  {porVencer > 0 ? (
                    <Link
                      href="/admin/alumnos"
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                    >
                      ver alumnos <ChevronRight className="size-3.5" aria-hidden />
                    </Link>
                  ) : null}
                </div>
                {porVencer > 0 ? (
                  <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-foreground">
                    <AlertCircle className="size-4 text-warning" aria-hidden />
                    {porVencer} {porVencer === 1 ? "membresía vence" : "membresías vencen"} en los próximos{" "}
                    {EXPIRY_WARNING_DAYS} días.
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">Sin vencimientos próximos.</p>
                )}
              </section>
            </div>

            {/* operación de hoy */}
            <div className="grid gap-4">
              <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-foreground">Ocupación de la semana</h2>
                  <span className="text-sm font-semibold text-foreground">{weekOcc}%</span>
                </div>
                <div className="mt-4 flex h-16 items-end justify-between gap-2">
                  {perDay.map((d, i) => (
                    <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
                      <div className="flex w-full flex-1 items-end overflow-hidden rounded-md bg-secondary">
                        <div
                          className={`w-full rounded-md transition-base ${d.today ? "bg-primary" : "bg-primary/60"}`}
                          style={{ height: `${Math.max(d.pct, 4)}%` }}
                          aria-hidden
                        />
                      </div>
                      <span className={`text-[10px] uppercase ${d.today ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                        {d.label}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {weekBooked} de {weekCap} lugares reservados (próximos 7 días).
                </p>
              </section>

              <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <h2 className="inline-flex items-center gap-1.5 text-base font-semibold text-foreground">
                  <CalendarClock className="size-4 text-muted-foreground" aria-hidden />
                  Clases de hoy
                </h2>
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
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <p className="text-sm text-muted-foreground">No hay clases hoy.</p>
                    <Link href="/admin/clases" className="text-sm font-medium text-primary hover:underline">
                      Ver agenda
                    </Link>
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
