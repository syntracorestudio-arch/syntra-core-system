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
  MessageCircle,
  UserMinus,
  Scale,
} from "lucide-react";
import { createSupabaseServer } from "@/lib/supabase/server";
import { CountUp } from "@/components/admin/count-up";
import { IncomeAreaChart } from "@/components/admin/income-area-chart";
import { IconChip, type ChipTone } from "@/components/ui/icon-chip";
import { Sparkline } from "@/components/admin/sparkline";
import { RadialGauge } from "@/components/admin/radial-gauge";

export const metadata = { title: "Resumen — Panel" };
export const dynamic = "force-dynamic";

const ADMIN_ROLES = ["admin", "reception"];
const DEFAULT_TZ = "America/Argentina/Buenos_Aires";
const EXPIRY_WARNING_DAYS = 14;
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_LABEL: Record<number, string> = { 1: "L", 2: "Ma", 3: "Mi", 4: "J", 5: "V", 6: "S", 0: "D" };
const DAY_FULL: Record<number, string> = { 1: "lun", 2: "mar", 3: "mié", 4: "jue", 5: "vie", 6: "sáb", 0: "dom" };
// Motivo de deuda por estado (la deuda es un estado derivado, no un monto).
const DEBT_LABEL: Record<string, string> = {
  membresia_vencida: "membresía vencida",
  pack_sin_saldo: "pack sin saldo",
  sin_creditos: "sin créditos",
  debe_pago: "sin plan activo",
};

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
    .select("role, profiles(full_name), studios(name, timezone)")
    .eq("profile_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!member || !ADMIN_ROLES.includes(member.role)) redirect("/app");
  // El home de recepción es la operación del día, no el dashboard del dueño.
  if (member.role === "reception") redirect("/admin/hoy");
  const isReception = member.role === "reception";
  const studioRel = (member.studios ?? null) as { name: string; timezone: string | null } | { name: string; timezone: string | null }[] | null;
  const studio = Array.isArray(studioRel) ? studioRel[0] : studioRel;
  const tz = studio?.timezone || DEFAULT_TZ;
  const meProf = (Array.isArray(member.profiles) ? member.profiles[0] : member.profiles) as ProfileRel | null;
  const firstName = (meProf?.full_name ?? "").split(" ")[0];

  const nowIso = new Date().toISOString();
  const todayLocal = tzDate(nowIso, tz);
  const thisYm = todayLocal.slice(0, 7);
  const monthStart = localToUtcISO(`${thisYm}-01`, "00:00", tz);
  const prevMonthStart = localToUtcISO(`${prevMonth(thisYm)}-01`, "00:00", tz);
  const todayStart = localToUtcISO(todayLocal, "00:00", tz);
  const tomorrowStart = localToUtcISO(addDays(todayLocal, 1), "00:00", tz);
  const weekEnd = localToUtcISO(addDays(todayLocal, 7), "00:00", tz);

  const limitIso = localToUtcISO(addDays(todayLocal, EXPIRY_WARNING_DAYS), "23:59", tz);
  const [{ data: pays }, { data: mems }, { data: fins }, { data: mships }, { data: occ }, { data: allRes }, { data: expPasses }, { data: wl }, { data: monthExp }] =
    await Promise.all([
      supabase.from("payments").select("amount, concept, paid_at").eq("status", "confirmed"),
      supabase.from("members").select("id, joined_at, profiles(full_name, phone)").eq("role", "client"),
      supabase.from("member_financial_status").select("member_id, financial_status"),
      supabase.from("memberships").select("valid_to, status").eq("status", "active"),
      supabase
        .from("class_occurrences")
        .select("id, starts_at, capacity, booked_count, classes(name, instructor_name)")
        .eq("status", "scheduled")
        .gte("starts_at", todayStart)
        .lt("starts_at", weekEnd)
        .order("starts_at", { ascending: true }),
      supabase.from("class_reservations").select("member_id, created_at").neq("status", "cancelled"),
      supabase.from("member_passes").select("id, member_id, expires_at").gt("expires_at", nowIso).lte("expires_at", limitIso),
      supabase.from("waitlist").select("occurrence_id").eq("status", "waiting"),
      // egresos del mes (RLS solo-admin → para reception devuelve vacío, y el tile ni se muestra)
      supabase.from("expenses").select("amount").gte("paid_at", monthStart),
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
  const prevMonthLabel = shortMonth(prevMonth(thisYm));

  // ---- rentabilidad del mes (ingresos − egresos) ----
  const egresosMes = ((monthExp ?? []) as { amount: number }[]).reduce((s, e) => s + Number(e.amount), 0);
  const resultadoMes = ingresosMes - egresosMes;
  const margenMes = ingresosMes > 0 ? Math.round((resultadoMes / ingresosMes) * 100) : null;
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
  type MemRow = { id: string; joined_at: string; profiles: (ProfileRel & { phone?: string | null }) | (ProfileRel & { phone?: string | null })[] | null };
  const nameById = new Map<string, string>();
  const phoneById = new Map<string, string | null>();
  const joinedById = new Map<string, string>();
  for (const m of (mems ?? []) as MemRow[]) {
    const prof = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
    nameById.set(m.id, prof?.full_name ?? "Alumno");
    phoneById.set(m.id, prof?.phone ?? null);
    joinedById.set(m.id, m.joined_at);
  }
  const studioName = studio?.name ?? "tu estudio";
  const waLink = (memberId: string, kind: "deuda" | "inactivo") => {
    const phone = (phoneById.get(memberId) ?? "").replace(/[^\d]/g, "");
    if (!phone) return null;
    const nombre = (nameById.get(memberId) ?? "").split(" ")[0];
    const text =
      kind === "deuda"
        ? `Hola ${nombre}! Te escribimos de ${studioName} 😊 Te recordamos que tenés un pago pendiente. ¿Lo coordinamos?`
        : `Hola ${nombre}! Te extrañamos en ${studioName} 😊 ¿Reservamos una clase esta semana?`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  };
  const finList = ((fins ?? []) as { member_id: string; financial_status: string }[]).filter((f) => nameById.has(f.member_id));
  const debtors = finList.filter((f) => f.financial_status !== "al_dia");
  const alDia = finList.length - debtors.length;

  // membresías + packs (con saldo) que vencen en la ventana de aviso
  const limitDate = addDays(todayLocal, EXPIRY_WARNING_DAYS);
  const porVencer = ((mships ?? []) as { valid_to: string; status: string }[]).filter(
    (m) => m.valid_to >= todayLocal && m.valid_to <= limitDate,
  ).length;
  const expiringPasses = (expPasses ?? []) as { id: string; member_id: string; expires_at: string }[];
  let packsPorVencer: { memberId: string; credits: number; expiresAt: string }[] = [];
  if (expiringPasses.length > 0) {
    const { data: led } = await supabase
      .from("credit_ledger")
      .select("member_pass_id, delta")
      .in("member_pass_id", expiringPasses.map((p) => p.id));
    const balance = new Map<string, number>();
    for (const l of (led ?? []) as { member_pass_id: string; delta: number }[]) {
      balance.set(l.member_pass_id, (balance.get(l.member_pass_id) ?? 0) + l.delta);
    }
    packsPorVencer = expiringPasses
      .filter((p) => (balance.get(p.id) ?? 0) > 0 && nameById.has(p.member_id))
      .map((p) => ({ memberId: p.member_id, credits: balance.get(p.id) ?? 0, expiresAt: p.expires_at }))
      .sort((a, b) => (a.expiresAt < b.expiresAt ? -1 : 1))
      .slice(0, 4);
  }

  // alumnos inactivos: sin reservas en 21+ días (o nunca reservaron y entraron hace 21+)
  const INACTIVE_DAYS = 21;
  const inactiveCutIso = localToUtcISO(addDays(todayLocal, -INACTIVE_DAYS), "00:00", tz);
  const lastResById = new Map<string, string>();
  for (const r of (allRes ?? []) as { member_id: string; created_at: string }[]) {
    const prev = lastResById.get(r.member_id);
    if (!prev || r.created_at > prev) lastResById.set(r.member_id, r.created_at);
  }
  const inactivos = [...nameById.keys()]
    .map((id) => ({ id, last: lastResById.get(id) ?? joinedById.get(id) ?? "" }))
    .filter((x) => x.last && x.last < inactiveCutIso)
    .sort((a, b) => (a.last < b.last ? -1 : 1))
    .slice(0, 5)
    .map((x) => ({
      id: x.id,
      days: Math.floor((Date.parse(nowIso) - Date.parse(x.last)) / 86_400_000),
      neverBooked: !lastResById.has(x.id),
    }));

  const needsAttention = debtors.length > 0 || porVencer > 0 || packsPorVencer.length > 0 || inactivos.length > 0;

  // demanda de lista de espera (próximos 7 días)
  const waitByOcc = new Map<string, number>();
  for (const w of (wl ?? []) as { occurrence_id: string }[]) {
    waitByOcc.set(w.occurrence_id, (waitByOcc.get(w.occurrence_id) ?? 0) + 1);
  }

  // ---- ocupación: semana + heatmap día×hora + clases de hoy ----
  type OccCls = { name: string; instructor_name: string | null };
  const occs = (occ ?? []) as { id: string; starts_at: string; capacity: number; booked_count: number; classes: OccCls | OccCls[] | null }[];

  // demanda de waitlist en la semana: total + pico (señal de abrir otra clase)
  const weekWaits = occs
    .map((o) => ({ o, n: waitByOcc.get(o.id) ?? 0 }))
    .filter((x) => x.n > 0);
  const waitTotal = weekWaits.reduce((s, x) => s + x.n, 0);
  const waitTop = weekWaits.sort((a, b) => b.n - a.n)[0] ?? null;
  const waitTopLabel = waitTop
    ? `${new Intl.DateTimeFormat("es-AR", { timeZone: tz, weekday: "short" }).format(new Date(waitTop.o.starts_at)).replace(/\./g, "")} ${timeOf(waitTop.o.starts_at, tz)}`
    : null;
  const weekCap = occs.reduce((s, o) => s + o.capacity, 0);
  const weekBooked = occs.reduce((s, o) => s + o.booked_count, 0);
  const weekOcc = weekCap > 0 ? Math.round((weekBooked / weekCap) * 100) : 0;
  const todayOccs = occs
    .filter((o) => o.starts_at >= todayStart && o.starts_at < tomorrowStart)
    .map((o) => {
      const cls = Array.isArray(o.classes) ? o.classes[0] : o.classes;
      return {
        id: o.id,
        time: timeOf(o.starts_at, tz),
        name: cls?.name ?? "Clase",
        instructor: cls?.instructor_name ?? null,
        booked: o.booked_count,
        capacity: o.capacity,
      };
    });

  // Quiénes vienen hoy (para los avatares apilados de "Clases de hoy")
  const attendeesByOcc = new Map<string, string[]>();
  if (todayOccs.length > 0) {
    const { data: todayRes } = await supabase
      .from("class_reservations")
      .select("occurrence_id, members(profiles(full_name))")
      .in("occurrence_id", todayOccs.map((o) => o.id))
      .in("status", ["booked", "attended", "no_show"]);
    for (const r of (todayRes ?? []) as {
      occurrence_id: string;
      members: { profiles: ProfileRel | ProfileRel[] | null } | { profiles: ProfileRel | ProfileRel[] | null }[] | null;
    }[]) {
      const m = Array.isArray(r.members) ? r.members[0] : r.members;
      const prof = m ? ((Array.isArray(m.profiles) ? m.profiles[0] : m.profiles) as ProfileRel | null) : null;
      const list = attendeesByOcc.get(r.occurrence_id) ?? [];
      list.push(prof?.full_name ?? "Alumno");
      attendeesByOcc.set(r.occurrence_id, list);
    }
  }

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
      {/* hero band: saludo sobre la foto del estudio (overlay cálido → texto AA; CLS 0 por altura fija) */}
      <header className="relative flex min-h-44 flex-wrap items-center justify-between gap-3 overflow-hidden rounded-3xl border border-border p-6 shadow-md sm:min-h-56">
        {/* la foto ocupa solo el lado derecho (área menos apaisada → se ve ~80% de la altura
            de la panorámica: camilla completa y profundidad) y se funde hacia el panel del texto */}
        <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-accent/60 via-card to-card" />
        {/* 66% = máximo ancho donde la camilla del primer plano entra completa (visible = 528/ancho) */}
        <div className="absolute inset-y-0 right-0 w-[68%] overflow-hidden sm:w-[66%]" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/hero-bg.jpg"
            alt=""
            className="anim-hero-settle absolute inset-0 size-full object-cover object-[62%_74%]"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(90deg, color-mix(in srgb, var(--card) 100%, transparent) 0%, transparent 34%)",
            }}
          />
        </div>
        <div className="relative">
          <p className="text-sm text-muted-foreground">
            {new Intl.DateTimeFormat("es-AR", { timeZone: tz, weekday: "long", day: "numeric", month: "long" }).format(
              new Date(nowIso),
            )}
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Hola{firstName ? `, ${firstName}` : ""} 👋
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Así está <span className="font-semibold text-foreground">{studio?.name ?? "tu estudio"}</span> hoy.
          </p>
        </div>
      </header>

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
        <div className="mt-6 grid gap-5">
          {/* ══ KPIs ══ */}
          <div className={`grid grid-cols-2 gap-3 ${isReception ? "lg:grid-cols-3" : "lg:grid-cols-5"} animate-in fade-in slide-in-from-bottom-2 duration-500`}>
            {!isReception ? (
              <Kpi
                icon={<TrendingUp className="size-4" aria-hidden />}
                label={`Ingresos de ${monthLabel}`}
                hero
              >
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <CountUp value={ingresosMes} prefix="$" className="text-2xl font-bold tabular-nums text-foreground" />
                  {delta !== null ? (
                    <span
                      className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        delta >= 0 ? "bg-success/15 text-success" : "bg-warning/15 text-warning"
                      }`}
                      title={`Mes en curso vs ${prevMonthLabel} completo`}
                    >
                      {delta >= 0 ? <TrendingUp className="size-3" aria-hidden /> : <TrendingDown className="size-3" aria-hidden />}
                      {delta >= 0 ? "+" : ""}
                      {delta}% vs {prevMonthLabel}
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {packsMes} {packsMes === 1 ? "pack" : "packs"} · {sueltasMes} {sueltasMes === 1 ? "suelta" : "sueltas"}
                </p>
                <div className="mt-2 text-primary">
                  <Sparkline data={incomeSeries.map((x) => x.value)} className="h-9 w-full" />
                </div>
              </Kpi>
            ) : null}

            {!isReception ? (
              <Kpi
                icon={<Scale className="size-4" aria-hidden />}
                label={`Resultado de ${monthLabel}`}
                tone={resultadoMes >= 0 ? "success" : "warning"}
                wash={
                  resultadoMes >= 0
                    ? "bg-gradient-to-br from-success/10 via-card to-card"
                    : "bg-gradient-to-br from-warning/15 via-card to-card"
                }
              >
                <p className={`text-2xl font-bold tabular-nums ${resultadoMes >= 0 ? "text-foreground" : "text-warning"}`}>
                  {resultadoMes < 0 ? "−" : ""}
                  {money(Math.abs(resultadoMes))}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {egresosMes > 0
                    ? `egresos ${money(egresosMes)}${margenMes !== null ? ` · margen ${margenMes}%` : ""}`
                    : "sin egresos cargados"}
                </p>
              </Kpi>
            ) : null}

            <Kpi
              icon={<Activity className="size-4" aria-hidden />}
              label="Ocupación semana"
              wash="bg-gradient-to-br from-accent/50 via-card to-card"
              aside={
                <span className="relative inline-flex text-primary">
                  <RadialGauge pct={weekOcc} size={52} stroke={6} />
                  <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold tabular-nums text-foreground">
                    {weekOcc}%
                  </span>
                </span>
              }
            >
              <p className="text-2xl font-bold tabular-nums text-foreground">
                {weekBooked}
                <span className="text-sm font-medium text-muted-foreground">/{weekCap}</span>
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">lugares reservados</p>
            </Kpi>

            <Kpi
              icon={<CheckCircle2 className="size-4" aria-hidden />}
              label="Alumnos al día"
              tone="success"
              wash="bg-gradient-to-br from-success/12 via-card to-card"
            >
              <p className="text-2xl font-bold tabular-nums text-foreground">
                {alDia}
                <span className="text-sm font-medium text-muted-foreground">/{finList.length}</span>
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">con saldo o abono</p>
              <span className="mt-2 block h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken" aria-hidden>
                <span
                  className="anim-grow-x block h-full rounded-full bg-success"
                  style={{ width: `${finList.length > 0 ? Math.round((alDia / finList.length) * 100) : 0}%` }}
                />
              </span>
            </Kpi>

            <Kpi
              icon={<AlertCircle className="size-4" aria-hidden />}
              label="Con deuda"
              tone={debtors.length > 0 ? "warning" : "muted"}
              wash={debtors.length > 0 ? "bg-gradient-to-br from-warning/15 via-card to-card" : undefined}
            >
              <p className="text-2xl font-bold tabular-nums text-foreground">{debtors.length}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">a cobrar</p>
              <span className="mt-2 block h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken" aria-hidden>
                <span
                  className={`anim-grow-x block h-full rounded-full ${debtors.length > 0 ? "bg-warning" : "bg-success"}`}
                  style={{ width: `${finList.length > 0 ? Math.max(Math.round((debtors.length / finList.length) * 100), debtors.length > 0 ? 6 : 0) : 0}%` }}
                />
              </span>
            </Kpi>
          </div>

          {/* ══ Ingresos (protagonista, solo admin) ══ */}
          {!isReception ? (
            <section className="rounded-2xl border border-border bg-card p-5 shadow-raised animate-in fade-in slide-in-from-bottom-2 duration-500 [animation-fill-mode:backwards]" style={{ animationDelay: "75ms" }}>
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
          <section
            className="rounded-2xl border border-border bg-card p-5 shadow-sm duration-500 animate-in fade-in slide-in-from-bottom-2 [animation-fill-mode:backwards]"
            style={{ animationDelay: "150ms" }}
          >
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
              <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 sm:items-start">
                {/* deudores + WhatsApp */}
                <div>
                  <p className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
                    <Wallet className="size-4 text-destructive" aria-hidden />
                    {debtors.length} {debtors.length === 1 ? "pago pendiente" : "pagos pendientes"}
                  </p>
                  {debtors.length > 0 ? (
                    <ul className="mt-2 divide-y divide-border">
                      {debtors.slice(0, 5).map((d) => {
                        const wa = waLink(d.member_id, "deuda");
                        return (
                          <li key={d.member_id} className="flex items-center justify-between gap-2 py-2">
                            <Link href={`/admin/alumnos/${d.member_id}`} className="group min-w-0 flex-1">
                              <span className="block truncate text-sm text-foreground group-hover:underline">
                                {nameById.get(d.member_id) ?? "Alumno"}
                              </span>
                              <span className="block text-[11px] text-muted-foreground">
                                {DEBT_LABEL[d.financial_status] ?? d.financial_status}
                              </span>
                            </Link>
                            <span className="flex shrink-0 items-center gap-1">
                              {wa ? (
                                <a
                                  href={wa}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="Recordar por WhatsApp"
                                  className="flex size-8 items-center justify-center rounded-lg bg-success/10 text-success transition-colors hover:bg-success/20"
                                >
                                  <MessageCircle className="size-4" aria-hidden />
                                </a>
                              ) : null}
                              <Link
                                href={`/admin/alumnos/${d.member_id}`}
                                className="inline-flex items-center gap-0.5 text-xs font-semibold text-primary-ink hover:underline"
                              >
                                cobrar <ChevronRight className="size-3.5" aria-hidden />
                              </Link>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="mt-1 text-sm text-muted-foreground">Nadie con deuda.</p>
                  )}
                  {debtors.length > 5 ? (
                    <Link href="/admin/alumnos" className="mt-2 inline-block text-xs font-semibold text-primary-ink hover:underline">
                      ver los {debtors.length}
                    </Link>
                  ) : null}
                </div>

                {/* vencimientos: membresías + packs con saldo */}
                <div>
                  <p className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
                    <Clock4 className="size-4 text-warning" aria-hidden />
                    Vencimientos próximos
                  </p>
                  {porVencer > 0 ? (
                    <p className="mt-2 text-sm text-foreground">
                      {porVencer} {porVencer === 1 ? "membresía vence" : "membresías vencen"} en {EXPIRY_WARNING_DAYS} días.
                    </p>
                  ) : null}
                  {packsPorVencer.length > 0 ? (
                    <ul className="mt-2 divide-y divide-border">
                      {packsPorVencer.map((p) => (
                        <li key={p.memberId + p.expiresAt}>
                          <Link
                            href={`/admin/alumnos/${p.memberId}`}
                            className="-mx-2 flex items-center justify-between gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-secondary"
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-sm text-foreground">{nameById.get(p.memberId)}</span>
                              <span className="block text-[11px] text-muted-foreground">
                                {p.credits} {p.credits === 1 ? "clase sin usar" : "clases sin usar"} · vence el{" "}
                                {new Intl.DateTimeFormat("es-AR", { timeZone: tz, day: "numeric", month: "short" })
                                  .format(new Date(p.expiresAt))
                                  .replace(/\./g, "")}
                              </span>
                            </span>
                            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {porVencer === 0 && packsPorVencer.length === 0 ? (
                    <p className="mt-2 text-sm text-muted-foreground">Sin vencimientos en {EXPIRY_WARNING_DAYS} días.</p>
                  ) : null}
                </div>

                {/* inactivos (riesgo de churn) */}
                <div>
                  <p className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
                    <UserMinus className="size-4 text-muted-foreground" aria-hidden />
                    Sin venir hace {INACTIVE_DAYS}+ días
                  </p>
                  {inactivos.length > 0 ? (
                    <ul className="mt-2 divide-y divide-border">
                      {inactivos.map((i) => {
                        const wa = waLink(i.id, "inactivo");
                        return (
                          <li key={i.id} className="flex items-center justify-between gap-2 py-2">
                            <Link href={`/admin/alumnos/${i.id}`} className="group min-w-0 flex-1">
                              <span className="block truncate text-sm text-foreground group-hover:underline">
                                {nameById.get(i.id)}
                              </span>
                              <span className="block text-[11px] text-muted-foreground">
                                {i.neverBooked ? `sin reservas desde el alta (${i.days} d)` : `última reserva hace ${i.days} días`}
                              </span>
                            </Link>
                            {wa ? (
                              <a
                                href={wa}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Invitar por WhatsApp"
                                className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success transition-colors hover:bg-success/20"
                              >
                                <MessageCircle className="size-4" aria-hidden />
                              </a>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">Todos vinieron hace poco. 💪</p>
                  )}
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
          <div
            className="grid gap-5 duration-500 animate-in fade-in slide-in-from-bottom-2 [animation-fill-mode:backwards] lg:grid-cols-2 lg:items-start"
            style={{ animationDelay: "225ms" }}
          >
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
                  {waitTotal > 0 ? (
                    <p className="mt-3 rounded-lg bg-warning/10 px-3 py-2 text-xs text-foreground">
                      <span className="font-semibold">{waitTotal}</span> en lista de espera esta semana
                      {waitTopLabel ? (
                        <>
                          {" "}· pico: <span className="font-semibold capitalize">{waitTopLabel}</span> ({waitTop!.n}) — señal
                          de sumar otra clase en ese horario
                        </>
                      ) : null}
                    </p>
                  ) : null}
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
                <Link href="/admin/clases" className="inline-flex items-center gap-1 text-xs font-semibold text-primary-ink hover:underline">
                  ver agenda <ChevronRight className="size-3.5" aria-hidden />
                </Link>
              </div>
              {todayOccs.length > 0 ? (
                <ul className="mt-3 divide-y divide-border">
                  {todayOccs.map((c, i) => {
                    const full = c.booked >= c.capacity;
                    const pct = c.capacity > 0 ? Math.round((c.booked / c.capacity) * 100) : 0;
                    const attendees = attendeesByOcc.get(c.id) ?? [];
                    return (
                      <li key={i} className="flex items-center justify-between gap-3 py-2.5">
                        <div className="flex min-w-0 items-baseline gap-3">
                          <span className="text-sm font-bold tabular-nums text-foreground">{c.time}</span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm text-foreground">{c.name}</span>
                            {c.instructor ? (
                              <span className="block truncate text-[11px] text-muted-foreground">{c.instructor}</span>
                            ) : null}
                          </span>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {attendees.length > 0 ? (
                            <span className="flex items-center">
                              {attendees.slice(0, 4).map((n, j) => (
                                <span
                                  key={j}
                                  title={n}
                                  className={`flex size-6 items-center justify-center rounded-full bg-accent text-[9px] font-bold text-primary-ink ring-2 ring-card ${
                                    j > 0 ? "-ml-1.5" : ""
                                  }`}
                                >
                                  {n
                                    .split(/\s+/)
                                    .slice(0, 2)
                                    .map((p) => p[0]?.toUpperCase() ?? "")
                                    .join("")}
                                </span>
                              ))}
                              {attendees.length > 4 ? (
                                <span className="-ml-1.5 flex size-6 items-center justify-center rounded-full bg-secondary text-[9px] font-bold text-muted-foreground ring-2 ring-card">
                                  +{attendees.length - 4}
                                </span>
                              ) : null}
                            </span>
                          ) : null}
                          <span
                            className="h-1.5 w-14 overflow-hidden rounded-full bg-surface-sunken"
                            role="img"
                            aria-label={`Ocupación ${pct}%`}
                          >
                            <span
                              className={`anim-grow-x block h-full rounded-full ${full ? "bg-destructive" : "bg-primary"}`}
                              style={{ width: `${Math.min(pct, 100)}%` }}
                            />
                          </span>
                          {full ? (
                            <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                              Lleno
                            </span>
                          ) : (
                            <span className="text-xs font-medium tabular-nums text-muted-foreground">
                              {c.booked}/{c.capacity}
                            </span>
                          )}
                        </div>
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
  wash,
  aside,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  tone?: ChipTone;
  hero?: boolean;
  /** fondo teñido de la card (gradiente por tono) — mata el "todo blanco parejo" */
  wash?: string;
  /** elemento a la derecha del header (ej. gauge radial) */
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-2xl border border-border p-4 shadow-sm transition-base hover:-translate-y-px hover:shadow-md ${
        hero
          ? "col-span-2 bg-gradient-to-br from-primary/15 via-card to-card lg:col-span-1"
          : wash ?? "bg-card"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <IconChip tone={tone}>{icon}</IconChip>
          {label}
        </p>
        {aside}
      </div>
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
