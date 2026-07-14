import { redirect } from "next/navigation";
import {
  Users,
  Home,
  Zap,
  Wrench,
  Package,
  Megaphone,
  Laptop,
  Tag,
  Trash2,
  Receipt,
  RotateCcw,
  Wallet,
  ChevronRight,
} from "lucide-react";
import { createSupabaseServer } from "@/lib/supabase/server";
import { PageHeader, HeaderStat } from "@/components/admin/page-header";
import { PeriodSelect } from "@/components/admin/period-select";
import { createExpense, deleteExpense, saveRate, repeatLastMonth } from "./actions";
import { ExpenseSubmit, RateSubmit } from "./submit-buttons";

export const metadata = { title: "Egresos — Panel" };
export const dynamic = "force-dynamic";

const DEFAULT_TZ = "America/Argentina/Buenos_Aires";

const CATEGORY_META: Record<string, { label: string; icon: typeof Tag }> = {
  staff: { label: "Sueldos", icon: Users },
  rent: { label: "Alquiler", icon: Home },
  utilities: { label: "Servicios", icon: Zap },
  equipment: { label: "Equipamiento", icon: Wrench },
  supplies: { label: "Insumos", icon: Package },
  marketing: { label: "Marketing", icon: Megaphone },
  software: { label: "Software", icon: Laptop },
  other: { label: "Otros", icon: Tag },
};

const RATE_LABEL: Record<string, string> = {
  per_class: "por clase",
  fixed_weekly: "fijo semanal",
  fixed_monthly: "fijo mensual",
};

function tzDate(iso: string, tz: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(new Date(iso))
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}`;
}
function shiftYm(ym: string, months: number) {
  const [y, m] = ym.split("-").map(Number);
  const idx = y * 12 + (m - 1) + months;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
}
function monthLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const s = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, 1)),
  );
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function money(n: number) {
  return `$${Math.round(n).toLocaleString("es-AR")}`;
}
function lastDayOfMonth(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return `${ym}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;
}

const inputCls =
  "rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring";

type ProfileRel = { full_name: string };
type StaffRow = { id: string; role: string; profiles: ProfileRel | ProfileRel[] | null };
type RateRow = { member_id: string; mode: string; amount: number };
type ExpenseRow = {
  id: string;
  category: string;
  amount: number;
  method: string;
  note: string | null;
  paid_at: string;
  member_id: string | null;
};

export default async function EgresosPage({
  searchParams,
}: {
  searchParams: Promise<{
    p?: string;
    notice?: string;
    error?: string;
    cat?: string;
    member?: string;
    amount?: string;
    note?: string;
    pstart?: string;
    pend?: string;
  }>;
}) {
  const sp = await searchParams;
  const { p, notice, error } = sp;
  const supabase = await createSupabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase
    .from("members")
    .select("role, studios(name, timezone)")
    .eq("profile_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!me) redirect("/app");
  if (me.role !== "admin") redirect("/admin"); // egresos = solo el dueño
  const studioRel = (me.studios ?? null) as { name: string; timezone: string | null } | { name: string; timezone: string | null }[] | null;
  const studio = Array.isArray(studioRel) ? studioRel[0] : studioRel;
  const tz = studio?.timezone || DEFAULT_TZ;

  const nowIso = new Date().toISOString();
  const todayLocal = tzDate(nowIso, tz);
  const thisYm = todayLocal.slice(0, 7);
  const isHistorico = p === "historico";
  const periodYm = p && /^\d{4}-\d{2}$/.test(p) ? p : thisYm;
  const periodLabel = isHistorico ? "histórico" : monthLabel(periodYm).toLowerCase();
  const startIso = `${periodYm}-01T00:00:00Z`;
  const endIso = `${shiftYm(periodYm, 1)}-01T00:00:00Z`;

  // ---- datos ----
  const [{ data: expRaw }, { data: staffRaw }, { data: ratesRaw }, { data: occRaw }] = await Promise.all([
    isHistorico
      ? supabase.from("expenses").select("id, category, amount, method, note, paid_at, member_id").order("paid_at", { ascending: false })
      : supabase
          .from("expenses")
          .select("id, category, amount, method, note, paid_at, member_id")
          .gte("paid_at", startIso)
          .lt("paid_at", endIso)
          .order("paid_at", { ascending: false }),
    supabase.from("members").select("id, role, profiles(full_name)").in("role", ["instructor", "reception"]).eq("status", "active"),
    supabase.from("staff_rates").select("member_id, mode, amount").is("valid_to", null),
    // clases DADAS del mes visible (para el sugerido por_clase): pasadas y no canceladas
    supabase
      .from("class_occurrences")
      .select("starts_at, classes(instructor_id)")
      .eq("status", "scheduled")
      .gte("starts_at", `${periodYm}-01T00:00:00Z`)
      .lt("starts_at", nowIso < endIso ? nowIso : endIso),
  ]);

  const expenses = (expRaw ?? []) as ExpenseRow[];
  const staff = ((staffRaw ?? []) as StaffRow[]).map((s) => {
    const prof = Array.isArray(s.profiles) ? s.profiles[0] : s.profiles;
    return { id: s.id, role: s.role, name: prof?.full_name ?? "Miembro" };
  });
  const nameById = new Map(staff.map((s) => [s.id, s.name]));
  const rateByMember = new Map(((ratesRaw ?? []) as RateRow[]).map((r) => [r.member_id, r]));

  // clases dadas por instructor en el período visible
  const classesGiven = new Map<string, number>();
  for (const o of (occRaw ?? []) as { starts_at: string; classes: { instructor_id: string | null } | { instructor_id: string | null }[] | null }[]) {
    const cls = Array.isArray(o.classes) ? o.classes[0] : o.classes;
    if (cls?.instructor_id) classesGiven.set(cls.instructor_id, (classesGiven.get(cls.instructor_id) ?? 0) + 1);
  }

  // pagado por miembro en el período (contexto en tarifas)
  const paidByMember = new Map<string, number>();
  for (const e of expenses) {
    if (e.category === "staff" && e.member_id) {
      paidByMember.set(e.member_id, (paidByMember.get(e.member_id) ?? 0) + Number(e.amount));
    }
  }

  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const byCat = new Map<string, number>();
  for (const e of expenses) byCat.set(e.category, (byCat.get(e.category) ?? 0) + Number(e.amount));

  // sugerido por miembro según su tarifa
  const suggestions = staff.map((s) => {
    const rate = rateByMember.get(s.id);
    if (!rate) return { ...s, rate: null, suggested: null as number | null, detail: "sin tarifa" };
    if (rate.mode === "per_class") {
      const n = classesGiven.get(s.id) ?? 0;
      return {
        ...s,
        rate,
        suggested: n * Number(rate.amount),
        detail: `${n} ${n === 1 ? "clase dada" : "clases dadas"} × ${money(Number(rate.amount))}`,
      };
    }
    return {
      ...s,
      rate,
      suggested: Number(rate.amount),
      detail: RATE_LABEL[rate.mode],
    };
  });

  // filtro del selector (últimos 12 meses + histórico)
  const options = [
    ...Array.from({ length: 12 }, (_, i) => {
      const ym = shiftYm(thisYm, -i);
      return { value: ym, label: monthLabel(ym) };
    }),
    { value: "historico", label: "Histórico" },
  ];

  const fmtDay = (iso: string) =>
    new Intl.DateTimeFormat("es-AR", { timeZone: tz, day: "2-digit", month: "short" }).format(new Date(iso)).replace(/\./g, "");

  // prefill del form (links "Pagar" de tarifas)
  const pre = {
    cat: sp.cat && CATEGORY_META[sp.cat] ? sp.cat : "staff",
    member: sp.member ?? "",
    amount: sp.amount ?? "",
    note: sp.note ?? "",
    pstart: sp.pstart ?? "",
    pend: sp.pend ?? "",
  };

  return (
    <main className="mx-auto min-h-dvh w-full max-w-6xl px-5 pb-16 pt-8 lg:px-8">
      <PageHeader
        title="Egresos"
        subtitle={studio?.name ?? "Tu estudio"}
        icon={Receipt}
        stat={<HeaderStat value={money(total)} caption={`en ${periodLabel}`} />}
      >
        {!isHistorico ? (
          <form action={repeatLastMonth}>
            <input type="hidden" name="ym" value={periodYm} />
            <button
              type="submit"
              title="Copia los egresos del mes anterior con fecha de hoy"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <RotateCcw className="size-3.5" aria-hidden />
              Repetir mes anterior
            </button>
          </form>
        ) : null}
        <PeriodSelect value={isHistorico ? "historico" : periodYm} options={options} basePath="/admin/egresos" />
      </PageHeader>

      {notice ? (
        <p className="mt-5 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">{notice}</p>
      ) : null}
      {error ? (
        <p className="mt-5 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        {/* ── lista de egresos ── */}
        <section>
          {expenses.length > 0 ? (
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <div className="divide-y divide-border">
                {expenses.map((e) => {
                  const meta = CATEGORY_META[e.category] ?? CATEGORY_META.other;
                  const Icon = meta.icon;
                  return (
                    <div key={e.id} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-primary-ink">
                        <Icon className="size-4" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-x-2 text-sm">
                          <span className="font-semibold text-foreground">{meta.label}</span>
                          {e.member_id ? (
                            <span className="text-muted-foreground">→ {nameById.get(e.member_id) ?? "ex-miembro"}</span>
                          ) : null}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {fmtDay(e.paid_at)}
                          {e.note ? ` · ${e.note}` : ""}
                          {e.method === "cash" ? " · efectivo" : e.method === "transfer" ? " · transferencia" : ""}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-bold tabular-nums text-foreground">{money(Number(e.amount))}</span>
                      <form action={deleteExpense}>
                        <input type="hidden" name="expenseId" value={e.id} />
                        <button
                          type="submit"
                          aria-label="Borrar egreso"
                          className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </button>
                      </form>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/60 px-6 py-16 text-center">
              <Receipt className="mx-auto size-6 text-muted-foreground" aria-hidden />
              <p className="mt-3 text-sm text-muted-foreground">
                Sin egresos en {periodLabel}. Registrá el primero con el panel de la derecha.
              </p>
            </div>
          )}

          {/* resumen por categoría del período */}
          {byCat.size > 1 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {[...byCat.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([cat, amt]) => (
                  <span
                    key={cat}
                    className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground"
                  >
                    {(CATEGORY_META[cat] ?? CATEGORY_META.other).label}
                    <strong className="tabular-nums">{money(amt)}</strong>
                  </span>
                ))}
            </div>
          ) : null}
        </section>

        {/* ── alta + tarifas ── */}
        <aside className="grid gap-4 lg:sticky lg:top-8">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h2 className="inline-flex items-center gap-1.5 text-base font-semibold text-foreground">
              <Receipt className="size-4 text-muted-foreground" aria-hidden />
              Registrar egreso
            </h2>
            <form action={createExpense} className="mt-4 grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium text-foreground">Categoría</span>
                  <select name="category" defaultValue={pre.cat} className={inputCls}>
                    {Object.entries(CATEGORY_META).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium text-foreground">Fecha</span>
                  <input type="date" name="paid_on" required defaultValue={todayLocal} className={inputCls} />
                </label>
              </div>
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium text-foreground">
                  Beneficiario <span className="text-muted-foreground">(solo sueldos)</span>
                </span>
                <select name="member_id" defaultValue={pre.member} className={inputCls}>
                  <option value="">—</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.role === "reception" ? "recepción" : "instructor"})
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium text-foreground">Monto</span>
                  <div className="flex items-center rounded-md border border-input bg-card focus-within:ring-2 focus-within:ring-ring">
                    <span className="pl-3 text-muted-foreground">$</span>
                    <input
                      name="amount"
                      type="number"
                      min={1}
                      step="0.01"
                      required
                      defaultValue={pre.amount}
                      className="w-full rounded-md bg-transparent px-2 py-2 text-sm text-foreground outline-none"
                    />
                  </div>
                </label>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium text-foreground">Método</span>
                  <select name="method" defaultValue="transfer" className={inputCls}>
                    <option value="transfer">Transferencia</option>
                    <option value="cash">Efectivo</option>
                    <option value="other">Otro</option>
                  </select>
                </label>
              </div>
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium text-foreground">
                  Nota <span className="text-muted-foreground">(opcional)</span>
                </span>
                <input name="note" maxLength={200} defaultValue={pre.note} placeholder="Ej: sueldo julio" className={inputCls} />
              </label>
              <input type="hidden" name="period_start" value={pre.pstart} />
              <input type="hidden" name="period_end" value={pre.pend} />
              <ExpenseSubmit />
            </form>
          </div>

          {/* tarifas del equipo + sugerido */}
          {staff.length > 0 ? (
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <h2 className="inline-flex items-center gap-1.5 text-base font-semibold text-foreground">
                <Wallet className="size-4 text-muted-foreground" aria-hidden />
                Tarifas del equipo
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Cómo le pagás a cada uno: por clase dada, fijo semanal o fijo mensual. El sugerido se calcula con las
                clases del período.
              </p>
              <ul className="mt-3 divide-y divide-border">
                {suggestions.map((s) => {
                  const paid = paidByMember.get(s.id) ?? 0;
                  const payHref = s.suggested
                    ? `/admin/egresos?${new URLSearchParams({
                        ...(isHistorico ? {} : { p: periodYm }),
                        cat: "staff",
                        member: s.id,
                        amount: String(s.suggested),
                        note: `Sueldo ${periodLabel} — ${s.name}`,
                        pstart: `${periodYm}-01`,
                        pend: lastDayOfMonth(periodYm),
                      }).toString()}`
                    : null;
                  return (
                    <li key={s.id} className="py-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="min-w-0 truncate text-sm font-semibold text-foreground">{s.name}</p>
                        {payHref ? (
                          <a
                            href={payHref}
                            className="inline-flex shrink-0 items-center gap-0.5 text-xs font-semibold text-primary-ink hover:underline"
                          >
                            pagar {money(s.suggested!)} <ChevronRight className="size-3.5" aria-hidden />
                          </a>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {s.rate ? s.detail : "Sin tarifa — definila abajo."}
                        {paid > 0 ? ` · ya pagado: ${money(paid)}` : ""}
                      </p>
                      <form action={saveRate} className="mt-2 flex items-center gap-2">
                        <input type="hidden" name="member_id" value={s.id} />
                        <select name="mode" defaultValue={s.rate?.mode ?? "per_class"} className={`${inputCls} flex-1`}>
                          <option value="per_class">Por clase</option>
                          <option value="fixed_weekly">Fijo semanal</option>
                          <option value="fixed_monthly">Fijo mensual</option>
                        </select>
                        <div className="flex w-28 items-center rounded-md border border-input bg-card focus-within:ring-2 focus-within:ring-ring">
                          <span className="pl-2 text-xs text-muted-foreground">$</span>
                          <input
                            name="amount"
                            type="number"
                            min={0}
                            step="0.01"
                            defaultValue={s.rate ? Number(s.rate.amount) : ""}
                            className="w-full rounded-md bg-transparent px-1.5 py-2 text-sm text-foreground outline-none"
                          />
                        </div>
                        <RateSubmit />
                      </form>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </aside>
      </div>
    </main>
  );
}
