import { redirect } from "next/navigation";
import {
  Ticket,
  CalendarDays,
  CreditCard,
  Wallet,
  Banknote,
  Landmark,
  CalendarX,
  UserX,
  BadgeCheck,
  TrendingUp,
  Sun,
  CalendarRange,
  Receipt,
  ReceiptText,
  UserPlus,
  Scale,
} from "lucide-react";
import { createSupabaseServer } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/page-header";
import { PeriodSelect } from "@/components/admin/period-select";
import { IconChip } from "@/components/ui/icon-chip";
import { DonutChart } from "@/components/admin/donut-chart";

export const metadata = { title: "Reportes — Panel" };
export const dynamic = "force-dynamic";

const DEFAULT_TZ = "America/Argentina/Buenos_Aires";

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
function firstOfMonthISO(ym: string, tz: string) {
  return localToUtcISO(`${ym}-01`, "00:00", tz);
}
function shiftYm(ym: string, months: number) {
  const [y, m] = ym.split("-").map(Number);
  const idx = y * 12 + (m - 1) + months;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
}
function money(n: number) {
  return `$${Math.round(n).toLocaleString("es-AR")}`;
}
function monthLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const s = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, 1)),
  );
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function shortMonth(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Intl.DateTimeFormat("es-AR", { month: "short", timeZone: "UTC" })
    .format(new Date(Date.UTC(y, m - 1, 1)))
    .replace(/\./g, "");
}

// Paleta categórica cálida (token-driven): cada segmento con identidad propia.
const CONCEPTS = [
  { key: "pack", label: "Packs", icon: Ticket, color: "var(--primary)" },
  { key: "drop_in", label: "Clases sueltas", icon: CalendarDays, color: "var(--warning)" },
  { key: "membership", label: "Membresías", icon: CreditCard, color: "var(--success)" },
  { key: "abono", label: "Abonos", icon: Wallet, color: "var(--muted-foreground)" },
] as const;

const METHODS = [
  { key: "cash", label: "Efectivo", icon: Banknote, color: "var(--success)" },
  { key: "transfer", label: "Transferencia", icon: Landmark, color: "var(--primary)" },
  { key: "card_manual", label: "Tarjeta", icon: CreditCard, color: "var(--warning)" },
  { key: "mercadopago", label: "MercadoPago", icon: Wallet, color: "var(--muted-foreground)" },
] as const;

// Categorías de egresos (mismo orden/labels que /admin/egresos)
const EXP_CATS = [
  { key: "staff", label: "Sueldos", color: "var(--primary)" },
  { key: "rent", label: "Alquiler", color: "var(--destructive)" },
  { key: "utilities", label: "Servicios", color: "var(--warning)" },
  { key: "equipment", label: "Equipamiento", color: "var(--success)" },
  { key: "supplies", label: "Insumos", color: "var(--primary-ink)" },
  { key: "marketing", label: "Marketing", color: "var(--accent-foreground)" },
  { key: "software", label: "Software", color: "var(--muted-foreground)" },
  { key: "other", label: "Otros", color: "var(--border)" },
] as const;

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string }>;
}) {
  const { p } = await searchParams;

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
  // Reportes = datos financieros → solo admin (reception no accede).
  if (!member || member.role !== "admin") redirect("/admin");
  const studioRel = (member.studios ?? null) as { name: string; timezone: string | null } | { name: string; timezone: string | null }[] | null;
  const studio = Array.isArray(studioRel) ? studioRel[0] : studioRel;
  const tz = studio?.timezone || DEFAULT_TZ;

  const nowIso = new Date().toISOString();
  const todayLocal = tzDate(nowIso, tz);
  const thisYm = todayLocal.slice(0, 7);

  // período seleccionado: "YYYY-MM" | "historico" (default: mes actual)
  const isHistorico = p === "historico";
  const periodYm = p && /^\d{4}-\d{2}$/.test(p) ? p : thisYm;
  let start: string | null = null;
  let end: string | null = null;
  if (!isHistorico) {
    start = firstOfMonthISO(periodYm, tz);
    end = firstOfMonthISO(shiftYm(periodYm, 1), tz);
  }
  const inRange = (iso: string | null) =>
    !!iso && (start === null || iso >= start) && (end === null || iso < end);
  const periodLabel = isHistorico ? "histórico" : monthLabel(periodYm).toLowerCase();

  // ventanas del "pulso de caja" (siempre actuales)
  const todayStart = localToUtcISO(todayLocal, "00:00", tz);
  const dow = new Date(`${todayLocal}T12:00:00Z`).getUTCDay(); // 0=dom
  const weekStart = localToUtcISO(addDays(todayLocal, -((dow + 6) % 7)), "00:00", tz);
  const monthStart = firstOfMonthISO(thisYm, tz);

  const [{ data: pays }, { data: occ }, { data: res }, { data: mships }, { data: newMems }, { data: exps }] = await Promise.all([
    supabase.from("payments").select("amount, concept, method, paid_at").eq("status", "confirmed"),
    supabase.from("class_occurrences").select("starts_at, capacity, booked_count, classes(name)"),
    supabase.from("class_reservations").select("status, cancelled_at"),
    supabase.from("memberships").select("valid_to, status").eq("status", "active"),
    supabase.from("members").select("joined_at").eq("role", "client"),
    supabase.from("expenses").select("amount, category, paid_at"),
  ]);

  const allPays = (pays ?? []) as { amount: number; concept: string; method: string; paid_at: string }[];
  const sumFrom = (fromIso: string) =>
    allPays.filter((x) => x.paid_at >= fromIso).reduce((s, x) => s + Number(x.amount), 0);
  const pulsoHoy = sumFrom(todayStart);
  const pulsoSemana = sumFrom(weekStart);
  const pulsoMes = sumFrom(monthStart);

  // tendencia (últimos 6 meses, siempre actual)
  const incomeByMonth = new Map<string, number>();
  for (const pay of allPays) {
    const k = pay.paid_at.slice(0, 7);
    incomeByMonth.set(k, (incomeByMonth.get(k) ?? 0) + Number(pay.amount));
  }
  // egresos: por mes (tendencia) + del período (balance/donut)
  const allExps = (exps ?? []) as { amount: number; category: string; paid_at: string }[];
  const expenseByMonth = new Map<string, number>();
  for (const e of allExps) {
    const k = e.paid_at.slice(0, 7);
    expenseByMonth.set(k, (expenseByMonth.get(k) ?? 0) + Number(e.amount));
  }

  const trend = Array.from({ length: 6 }, (_, i) => {
    const ym = shiftYm(thisYm, -(5 - i));
    return {
      ym,
      value: incomeByMonth.get(ym) ?? 0,
      exp: expenseByMonth.get(ym) ?? 0,
      label: shortMonth(ym),
      current: ym === thisYm,
    };
  });
  const maxTrend = Math.max(1, ...trend.map((t) => Math.max(t.value, t.exp)));

  // ---- período: ingresos por concepto / método, ticket, nuevos ----
  const periodPays = allPays.filter((x) => inRange(x.paid_at));
  const ingresosTotal = periodPays.reduce((s, x) => s + Number(x.amount), 0);
  const ticketProm = periodPays.length > 0 ? ingresosTotal / periodPays.length : 0;
  const alumnosNuevos = ((newMems ?? []) as { joined_at: string }[]).filter((m) => inRange(m.joined_at)).length;

  // ---- balance del período (rentabilidad) ----
  const periodExps = allExps.filter((e) => inRange(e.paid_at));
  const egresosTotal = periodExps.reduce((s, e) => s + Number(e.amount), 0);
  const resultado = ingresosTotal - egresosTotal;
  const margen = ingresosTotal > 0 ? Math.round((resultado / ingresosTotal) * 100) : null;
  const ventasParaCubrir = egresosTotal > 0 && ticketProm > 0 ? Math.ceil(egresosTotal / ticketProm) : null;
  const expByCat = new Map<string, number>();
  for (const e of periodExps) expByCat.set(e.category, (expByCat.get(e.category) ?? 0) + Number(e.amount));

  const byConcept = new Map<string, { amount: number; count: number }>();
  const byMethod = new Map<string, { amount: number; count: number }>();
  for (const pay of periodPays) {
    const c = byConcept.get(pay.concept) ?? { amount: 0, count: 0 };
    c.amount += Number(pay.amount);
    c.count += 1;
    byConcept.set(pay.concept, c);
    const mth = byMethod.get(pay.method) ?? { amount: 0, count: 0 };
    mth.amount += Number(pay.amount);
    mth.count += 1;
    byMethod.set(pay.method, mth);
  }
  const maxMethod = Math.max(1, ...METHODS.map((m) => byMethod.get(m.key)?.amount ?? 0));

  // ---- ocupación por clase (período) ----
  const occRows = (occ ?? []) as {
    starts_at: string;
    capacity: number;
    booked_count: number;
    classes: { name: string } | { name: string }[] | null;
  }[];
  const byClass = new Map<string, { booked: number; cap: number; count: number }>();
  for (const o of occRows) {
    if (!inRange(o.starts_at)) continue;
    const cls = Array.isArray(o.classes) ? o.classes[0] : o.classes;
    const name = cls?.name ?? "Clase";
    const acc = byClass.get(name) ?? { booked: 0, cap: 0, count: 0 };
    acc.booked += o.booked_count;
    acc.cap += o.capacity;
    acc.count += 1;
    byClass.set(name, acc);
  }
  const ocupacion = [...byClass.entries()]
    .map(([name, v]) => ({ name, pct: v.cap > 0 ? Math.round((v.booked / v.cap) * 100) : 0, count: v.count }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 8);

  // ---- retención (período) ----
  const reservations = (res ?? []) as { status: string; cancelled_at: string | null }[];
  const cancelaciones = reservations.filter((r) => r.status === "cancelled" && inRange(r.cancelled_at)).length;
  const noShows = reservations.filter((r) => r.status === "no_show").length;
  const abonosActivos = ((mships ?? []) as { valid_to: string; status: string }[]).filter(
    (m) => m.valid_to >= todayLocal,
  ).length;

  // opciones del filtro: últimos 12 meses + histórico
  const options = [
    ...Array.from({ length: 12 }, (_, i) => {
      const ym = shiftYm(thisYm, -i);
      return { value: ym, label: monthLabel(ym) };
    }),
    { value: "historico", label: "Histórico" },
  ];

  return (
    <main className="mx-auto min-h-dvh w-full max-w-6xl px-5 pb-16 pt-8 lg:px-8">
      <PageHeader title="Reportes" subtitle={studio?.name ?? "Tu estudio"} />

      <div className="mt-6 grid gap-5 animate-in fade-in slide-in-from-bottom-2 duration-500">
        {/* ── Pulso de caja (siempre actual) ── */}
        <section className="grid gap-3 sm:grid-cols-3">
          <PulseTile icon={<Sun className="size-4" aria-hidden />} label="Ingresos de hoy" value={money(pulsoHoy)} />
          <PulseTile icon={<CalendarRange className="size-4" aria-hidden />} label="Esta semana" value={money(pulsoSemana)} />
          <PulseTile icon={<TrendingUp className="size-4" aria-hidden />} label="Este mes" value={money(pulsoMes)} hero />
        </section>

        {/* ── Tendencia ingresos vs egresos (6 meses, siempre actual) ── */}
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-foreground">Ingresos vs egresos</h2>
              <p className="text-xs text-muted-foreground">Últimos 6 meses</p>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-primary" aria-hidden /> ingresos
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-warning/70" aria-hidden /> egresos
              </span>
            </div>
          </div>
          <div className="mt-4 flex items-end justify-between gap-2 sm:gap-3">
            {trend.map((t) => (
              <div key={t.ym} className="flex flex-1 flex-col items-center gap-1.5">
                <span className="text-[10px] tabular-nums text-muted-foreground">
                  {t.value > 0 ? `$${Math.round(t.value / 1000)}k` : ""}
                </span>
                {/* barras pareadas desde la línea base (la altura ES el valor) */}
                <div className="flex h-24 w-full items-end justify-center gap-1 border-b border-border/70">
                  <div
                    className={`w-2/5 max-w-7 rounded-t-md transition-base ${t.current ? "bg-primary" : "bg-primary/50"}`}
                    style={{ height: `${Math.max(Math.round((t.value / maxTrend) * 100), t.value > 0 ? 4 : 1)}%` }}
                    aria-hidden
                  />
                  <div
                    className={`w-2/5 max-w-7 rounded-t-md transition-base ${t.current ? "bg-warning/80" : "bg-warning/45"}`}
                    style={{ height: `${Math.max(Math.round((t.exp / maxTrend) * 100), t.exp > 0 ? 4 : 1)}%` }}
                    aria-hidden
                  />
                </div>
                <span className={`text-[11px] capitalize ${t.current ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                  {t.label}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Filtro de período ── */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <h2 className="text-lg font-bold tracking-tight text-foreground">Detalle del período</h2>
          <PeriodSelect value={isHistorico ? "historico" : periodYm} options={options} />
        </div>

        {/* Balance del período (ingresos − egresos = resultado) + KPIs */}
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <PulseTile icon={<Wallet className="size-4" aria-hidden />} label={`Ingresos ${periodLabel}`} value={money(ingresosTotal)} />
          <PulseTile icon={<ReceiptText className="size-4" aria-hidden />} label="Egresos" value={money(egresosTotal)} />
          <div
            className={`rounded-2xl border border-border p-4 shadow-sm transition-base hover:-translate-y-px hover:shadow-md ${
              resultado >= 0
                ? "bg-gradient-to-br from-success/12 via-card to-card"
                : "bg-gradient-to-br from-warning/15 via-card to-card"
            }`}
          >
            <p className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <IconChip tone={resultado >= 0 ? "success" : "warning"}>
                <Scale className="size-4" aria-hidden />
              </IconChip>
              Resultado
            </p>
            <p className={`mt-1 text-2xl font-bold tracking-tight tabular-nums ${resultado >= 0 ? "text-foreground" : "text-warning"}`}>
              {resultado < 0 ? "−" : ""}
              {money(Math.abs(resultado))}
            </p>
            {margen !== null ? <p className="mt-0.5 text-xs text-muted-foreground">margen {margen}%</p> : null}
          </div>
          <PulseTile icon={<Receipt className="size-4" aria-hidden />} label="Ticket promedio" value={money(ticketProm)} />
          <PulseTile icon={<UserPlus className="size-4" aria-hidden />} label="Alumnos nuevos" value={String(alumnosNuevos)} />
        </section>
        {ventasParaCubrir !== null ? (
          <p className="-mt-2 text-xs text-muted-foreground">
            Para cubrir los egresos de {periodLabel} necesitás ~{ventasParaCubrir}{" "}
            {ventasParaCubrir === 1 ? "venta" : "ventas"} al ticket promedio.
          </p>
        ) : null}

        {/* items estirados (sin items-start): las cards de cada fila quedan parejas, sin huecos */}
        <div className="grid gap-5 lg:grid-cols-2">
          {/* Ingresos por concepto — DONUT (variedad visual vs barras/líneas) */}
          <section className="flex flex-col rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h2 className="text-base font-semibold text-foreground">Ingresos por concepto</h2>
            <p className="text-xs capitalize text-muted-foreground">{periodLabel}</p>
            {ingresosTotal > 0 ? (
              <div className="mt-4 flex flex-1 flex-wrap items-center gap-5">
                <DonutChart
                  size={136}
                  stroke={20}
                  centerValue={money(ingresosTotal)}
                  centerLabel="total"
                  slices={CONCEPTS.map((cc) => ({
                    label: cc.label,
                    value: byConcept.get(cc.key)?.amount ?? 0,
                    color: cc.color,
                  }))}
                />
                <ul className="min-w-0 flex-1 grid gap-2">
                  {CONCEPTS.map((cc) => {
                    const v = byConcept.get(cc.key) ?? { amount: 0, count: 0 };
                    const share = ingresosTotal > 0 ? Math.round((v.amount / ingresosTotal) * 100) : 0;
                    return (
                      <li
                        key={cc.key}
                        className={`flex items-center justify-between gap-2 text-sm ${v.amount === 0 ? "opacity-45" : ""}`}
                      >
                        <span className="inline-flex min-w-0 items-center gap-2">
                          <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: cc.color }} aria-hidden />
                          <span className="truncate text-foreground">{cc.label}</span>
                        </span>
                        <span className="shrink-0 tabular-nums">
                          <span className="font-semibold text-foreground">{money(v.amount)}</span>
                          <span className="ml-1.5 text-xs text-muted-foreground">{share}%</span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">Sin ingresos en {periodLabel}.</p>
            )}
          </section>

          {/* Ingresos por método de pago — barras horizontales multicolor */}
          <BreakdownCard title="Ingresos por método de pago" subtitle={periodLabel} rows={METHODS} data={byMethod} max={maxMethod} empty={ingresosTotal === 0} />

          {/* Egresos por categoría — donut espejo del de ingresos */}
          <section className="flex flex-col rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h2 className="text-base font-semibold text-foreground">Egresos por categoría</h2>
            <p className="text-xs capitalize text-muted-foreground">{periodLabel}</p>
            {egresosTotal > 0 ? (
              <div className="mt-4 flex flex-1 flex-wrap items-center gap-5">
                <DonutChart
                  size={136}
                  stroke={20}
                  centerValue={money(egresosTotal)}
                  centerLabel="total"
                  slices={EXP_CATS.map((c) => ({
                    label: c.label,
                    value: expByCat.get(c.key) ?? 0,
                    color: c.color,
                  }))}
                />
                <ul className="grid min-w-0 flex-1 gap-2">
                  {EXP_CATS.filter((c) => (expByCat.get(c.key) ?? 0) > 0)
                    .sort((a, b) => (expByCat.get(b.key) ?? 0) - (expByCat.get(a.key) ?? 0))
                    .map((c) => {
                      const amt = expByCat.get(c.key) ?? 0;
                      const share = Math.round((amt / egresosTotal) * 100);
                      return (
                        <li key={c.key} className="flex items-center justify-between gap-2 text-sm">
                          <span className="inline-flex min-w-0 items-center gap-2">
                            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: c.color }} aria-hidden />
                            <span className="truncate text-foreground">{c.label}</span>
                          </span>
                          <span className="shrink-0 tabular-nums">
                            <span className="font-semibold text-foreground">{money(amt)}</span>
                            <span className="ml-1.5 text-xs text-muted-foreground">{share}%</span>
                          </span>
                        </li>
                      );
                    })}
                </ul>
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                Sin egresos en {periodLabel}. Registralos en la sección Egresos del menú.
              </p>
            )}
          </section>

          {/* Ocupación por clase */}
          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h2 className="text-base font-semibold text-foreground">Ocupación por clase</h2>
            <p className="text-xs text-muted-foreground">Qué clases llenan · {periodLabel}</p>
            {ocupacion.length > 0 ? (
              <ul className="mt-4 grid gap-3">
                {ocupacion.map((o) => (
                  <li key={o.name}>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate font-medium text-foreground">{o.name}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {o.pct}% · {o.count} {o.count === 1 ? "clase" : "clases"}
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-secondary">
                      <div
                        className={`h-full rounded-full transition-base ${o.pct >= 85 ? "bg-primary" : "bg-primary/60"}`}
                        style={{ width: `${Math.max(o.pct, 3)}%` }}
                        aria-hidden
                      />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">Sin clases en {periodLabel}.</p>
            )}
          </section>

          {/* Retención — full-width: 5 cards en grilla de 2 dejaban un hueco al cierre */}
          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm lg:col-span-2">
            <h2 className="text-base font-semibold text-foreground">Retención</h2>
            <p className="text-xs text-muted-foreground">Cancelaciones y ausencias · {periodLabel}</p>
            <div className="mt-4 grid grid-cols-3 gap-3">
              <StatBox icon={<CalendarX className="size-4" aria-hidden />} value={cancelaciones} label="cancelaciones" tone="warning" />
              <StatBox icon={<UserX className="size-4" aria-hidden />} value={noShows} label={noShows === 1 ? "ausencia" : "ausencias"} tone="muted" />
              <StatBox icon={<BadgeCheck className="size-4" aria-hidden />} value={abonosActivos} label="abonos activos" tone="success" />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Las ausencias se registran con el check-in del instructor; abonos activos es el estado de hoy.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}

function PulseTile({ icon, label, value, hero = false }: { icon: React.ReactNode; label: string; value: string; hero?: boolean }) {
  return (
    <div
      className={`rounded-2xl border border-border p-4 shadow-sm transition-base hover:-translate-y-px hover:shadow-md ${
        hero ? "bg-gradient-to-br from-primary/15 via-card to-card" : "bg-gradient-to-br from-accent/30 via-card to-card"
      }`}
    >
      <p className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <IconChip>{icon}</IconChip>
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold tracking-tight tabular-nums text-foreground">{value}</p>
    </div>
  );
}

function BreakdownCard({
  title,
  subtitle,
  rows,
  data,
  max,
  empty,
}: {
  title: string;
  subtitle: string;
  rows: readonly { key: string; label: string; icon: typeof Ticket; color?: string }[];
  data: Map<string, { amount: number; count: number }>;
  max: number;
  empty: boolean;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <p className="text-xs capitalize text-muted-foreground">{subtitle}</p>
      {!empty ? (
        <ul className="mt-4 grid gap-3">
          {rows.map((r) => {
            const v = data.get(r.key) ?? { amount: 0, count: 0 };
            const Icon = r.icon;
            return (
              <li key={r.key} className={v.amount === 0 ? "opacity-45" : undefined}>
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                    <Icon className="size-4 text-muted-foreground" aria-hidden />
                    {r.label}
                  </span>
                  <span className="tabular-nums font-semibold text-foreground">{money(v.amount)}</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full transition-base"
                    style={{
                      width: `${Math.round((v.amount / max) * 100)}%`,
                      backgroundColor: r.color ?? "var(--primary)",
                    }}
                    aria-hidden
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {v.count} {v.count === 1 ? "venta" : "ventas"}
                </p>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">Sin ingresos en {subtitle}.</p>
      )}
    </section>
  );
}

function StatBox({
  icon,
  value,
  label,
  tone,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  tone: "warning" | "success" | "muted";
}) {
  const toneCls =
    tone === "warning"
      ? "bg-warning/15 text-warning"
      : tone === "success"
        ? "bg-success/15 text-success"
        : "bg-secondary text-muted-foreground";
  const wash =
    tone === "warning"
      ? "bg-gradient-to-br from-warning/12 via-card to-card"
      : tone === "success"
        ? "bg-gradient-to-br from-success/12 via-card to-card"
        : "bg-gradient-to-br from-accent/40 via-card to-card";
  return (
    <div className={`rounded-xl border border-border/70 p-3 text-center ${wash}`}>
      <span className={`mx-auto flex size-8 items-center justify-center rounded-full ${toneCls}`}>{icon}</span>
      <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{value}</p>
      <p className="text-[11px] leading-tight text-muted-foreground">{label}</p>
    </div>
  );
}
