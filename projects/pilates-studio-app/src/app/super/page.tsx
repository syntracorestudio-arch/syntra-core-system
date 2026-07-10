import Link from "next/link";
import {
  Building2,
  Plus,
  Users,
  GraduationCap,
  Power,
  ExternalLink,
  CheckCircle2,
  PauseCircle,
  Wallet,
  CalendarDays,
  UserPlus,
  Moon,
  CreditCard,
} from "lucide-react";
import { requireSuperadmin } from "@/lib/superadmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { IconChip } from "@/components/ui/icon-chip";
import { createStudio, toggleStudioStatus } from "./actions";
import { SubmitButton } from "./submit-button";
import { SuperFilters } from "./filters";

export const metadata = { title: "Estudios — Superadmin" };
export const dynamic = "force-dynamic";

const TZ_AR = "America/Argentina/Buenos_Aires";

const inputCls =
  "rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring";

type StudioRow = {
  id: string;
  name: string;
  slug: string;
  status: "active" | "suspended";
  timezone: string;
  created_at: string;
};

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
function shortMonth(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Intl.DateTimeFormat("es-AR", { month: "short", timeZone: "UTC" })
    .format(new Date(Date.UTC(y, m - 1, 1)))
    .replace(/\./g, "");
}
function money(n: number) {
  return `$${Math.round(n).toLocaleString("es-AR")}`;
}
/** Inicio de mes AR en ISO (AR es UTC-3 sin DST → 03:00Z). */
function monthStartIso(ym: string) {
  return `${ym}-01T03:00:00.000Z`;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="font-medium text-foreground">{label}</span>
      {children}
    </label>
  );
}

function Metric({
  icon,
  label,
  value,
  detail,
  hero = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail?: string;
  hero?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border border-border p-4 shadow-sm ${
        hero ? "bg-gradient-to-br from-primary/10 via-card to-card" : "bg-card"
      }`}
    >
      <p className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <IconChip>{icon}</IconChip>
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold tracking-tight tabular-nums text-foreground">{value}</p>
      {detail ? <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p> : null}
    </div>
  );
}

export default async function SuperPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string; p?: string; studio?: string }>;
}) {
  const { notice, error, p, studio: studioParam } = await searchParams;
  await requireSuperadmin();

  // Ventanas de tiempo
  const now = new Date();
  const nowIso = now.toISOString();
  const thisYm = new Intl.DateTimeFormat("en-CA", { timeZone: TZ_AR, year: "numeric", month: "2-digit" })
    .format(now)
    .slice(0, 7);
  const isHistorico = p === "historico";
  const periodYm = p && /^\d{4}-\d{2}$/.test(p) ? p : thisYm;
  const periodStart = isHistorico ? null : monthStartIso(periodYm);
  const periodEnd = isHistorico ? null : monthStartIso(shiftYm(periodYm, 1));
  const inPeriod = (iso: string | null) =>
    !!iso && (periodStart === null || iso >= periodStart) && (periodEnd === null || iso < periodEnd);
  const weekEndIso = new Date(now.getTime() + 7 * 86_400_000).toISOString();
  const activityWindowIso = new Date(now.getTime() - 30 * 86_400_000).toISOString();

  // Datos globales vía service-role (el gate ya validó superadmin).
  const admin = createAdminClient();
  const [
    { data: studiosRaw },
    { data: membersRaw },
    { data: paysRaw },
    { data: occRaw },
    { data: mpRaw },
    { data: resRaw },
  ] = await Promise.all([
    admin.from("studios").select("id, name, slug, status, timezone, created_at").order("created_at", { ascending: false }),
    admin.from("members").select("studio_id, role, status, joined_at"),
    admin.from("payments").select("studio_id, amount, paid_at").eq("status", "confirmed"),
    admin
      .from("class_occurrences")
      .select("studio_id, booked_count, capacity")
      .eq("status", "scheduled")
      .gte("starts_at", nowIso)
      .lt("starts_at", weekEndIso),
    admin.from("studio_payment_providers").select("studio_id, status"),
    admin.from("class_reservations").select("studio_id, created_at").gte("created_at", activityWindowIso),
  ]);
  const studios = (studiosRaw ?? []) as StudioRow[];
  const members = (membersRaw ?? []) as { studio_id: string; role: string; status: string; joined_at: string | null }[];
  const pays = (paysRaw ?? []) as { studio_id: string; amount: number; paid_at: string }[];
  const occs = (occRaw ?? []) as { studio_id: string; booked_count: number; capacity: number }[];
  const mpConnected = new Set(
    ((mpRaw ?? []) as { studio_id: string; status: string }[]).filter((r) => r.status === "connected").map((r) => r.studio_id),
  );
  const recentRes = (resRaw ?? []) as { studio_id: string; created_at: string }[];

  // Filtro por estudio
  const studioFilter = studios.some((s) => s.id === studioParam) ? (studioParam as string) : "todos";
  const scoped = <T extends { studio_id: string }>(rows: T[]) =>
    studioFilter === "todos" ? rows : rows.filter((r) => r.studio_id === studioFilter);

  // ---- conteos por estudio (siempre globales para las filas) ----
  const counts = new Map<string, { clients: number; staff: number }>();
  for (const m of members) {
    if (m.status !== "active") continue;
    const c = counts.get(m.studio_id) ?? { clients: 0, staff: 0 };
    if (m.role === "client") c.clients += 1;
    else c.staff += 1;
    counts.set(m.studio_id, c);
  }

  // ---- KPIs del período (respetan ambos filtros) ----
  const periodPays = scoped(pays).filter((x) => inPeriod(x.paid_at));
  const volumen = periodPays.reduce((s, x) => s + Number(x.amount), 0);
  const nuevos = scoped(members).filter((m) => m.role === "client" && inPeriod(m.joined_at)).length;
  const weekOccs = scoped(occs);
  const weekBooked = weekOccs.reduce((s, o) => s + o.booked_count, 0);
  const weekCap = weekOccs.reduce((s, o) => s + o.capacity, 0);
  const weekPct = weekCap > 0 ? Math.round((weekBooked / weekCap) * 100) : 0;
  const activeStudios = studios.filter((s) => s.status === "active").length;
  const suspendedStudios = studios.length - activeStudios;
  const periodTitle = isHistorico ? "histórico" : monthLabel(periodYm).toLowerCase();

  // ---- tendencia 6 meses (respeta filtro de estudio) ----
  const byMonth = new Map<string, number>();
  for (const x of scoped(pays)) {
    const k = x.paid_at.slice(0, 7);
    byMonth.set(k, (byMonth.get(k) ?? 0) + Number(x.amount));
  }
  const trend = Array.from({ length: 6 }, (_, i) => {
    const ym = shiftYm(thisYm, -(5 - i));
    return { ym, value: byMonth.get(ym) ?? 0, label: shortMonth(ym), current: ym === thisYm };
  });
  const maxTrend = Math.max(1, ...trend.map((t) => t.value));

  // ---- salud por estudio: última actividad (cobro o reserva, ventana 30 días) ----
  const lastActivity = new Map<string, string>();
  for (const r of recentRes) {
    const prev = lastActivity.get(r.studio_id);
    if (!prev || r.created_at > prev) lastActivity.set(r.studio_id, r.created_at);
  }
  for (const x of pays) {
    if (x.paid_at < activityWindowIso) continue;
    const prev = lastActivity.get(x.studio_id);
    if (!prev || x.paid_at > prev) lastActivity.set(x.studio_id, x.paid_at);
  }
  const daysSince = (iso: string) => Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000);

  // ---- GMV del período por estudio (para las filas) ----
  const gmvByStudio = new Map<string, number>();
  for (const x of pays) {
    if (!inPeriod(x.paid_at)) continue;
    gmvByStudio.set(x.studio_id, (gmvByStudio.get(x.studio_id) ?? 0) + Number(x.amount));
  }

  // ---- opciones de filtros ----
  const periodOptions = [
    ...Array.from({ length: 12 }, (_, i) => {
      const ym = shiftYm(thisYm, -i);
      return { value: ym, label: monthLabel(ym) };
    }),
    { value: "historico", label: "Histórico" },
  ];
  const studioOptions = [
    { value: "todos", label: "Todos los estudios" },
    ...studios.map((s) => ({ value: s.id, label: s.name })),
  ];
  const filteredStudioName = studioFilter !== "todos" ? studios.find((s) => s.id === studioFilter)?.name : null;

  const fmtDate = (iso: string) =>
    new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso));

  return (
    <main className="mx-auto min-h-dvh w-full max-w-6xl px-5 pb-16 pt-8 lg:px-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Estudios</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Alta y gestión de los estudios de la plataforma.</p>
        </div>
        <SuperFilters
          period={isHistorico ? "historico" : periodYm}
          periodOptions={periodOptions}
          studio={studioFilter}
          studioOptions={studioOptions}
        />
      </header>

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

      {/* ── Métricas del período (respetan filtros) ── */}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric
          icon={<Wallet className="size-4" aria-hidden />}
          label={`Volumen · ${periodTitle}`}
          value={money(volumen)}
          detail={`${periodPays.length} ${periodPays.length === 1 ? "cobro" : "cobros"}${filteredStudioName ? ` · ${filteredStudioName}` : " en la plataforma"}`}
          hero
        />
        <Metric
          icon={<UserPlus className="size-4" aria-hidden />}
          label={`Alumnos nuevos · ${periodTitle}`}
          value={String(nuevos)}
          detail={filteredStudioName ?? "todas las altas"}
        />
        <Metric
          icon={<Building2 className="size-4" aria-hidden />}
          label="Estudios activos"
          value={String(activeStudios)}
          detail={suspendedStudios > 0 ? `${suspendedStudios} suspendido${suspendedStudios === 1 ? "" : "s"}` : "todos operando"}
        />
        <Metric
          icon={<CalendarDays className="size-4" aria-hidden />}
          label="Reservas próximos 7 días"
          value={String(weekBooked)}
          detail={weekCap > 0 ? `${weekPct}% de ocupación` : "sin clases programadas"}
        />
      </div>

      {/* ── Tendencia de volumen (6 meses) ── */}
      <section className="mt-5 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-base font-semibold text-foreground">
          Tendencia de volumen{filteredStudioName ? ` · ${filteredStudioName}` : ""}
        </h2>
        <p className="text-xs text-muted-foreground">Últimos 6 meses{filteredStudioName ? "" : " · toda la plataforma"}</p>
        <div className="mt-4 flex items-end justify-between gap-2 sm:gap-3">
          {trend.map((t) => (
            <div key={t.ym} className="flex flex-1 flex-col items-center gap-1.5">
              <span className="text-[10px] tabular-nums text-muted-foreground">
                {t.value > 0 ? `$${Math.round(t.value / 1000)}k` : ""}
              </span>
              <div className="flex h-20 w-full items-end border-b border-border/70">
                <div
                  className={`w-full rounded-t-md transition-base ${t.current ? "bg-primary" : "bg-primary/50"}`}
                  style={{ height: `${Math.max(Math.round((t.value / maxTrend) * 100), t.value > 0 ? 4 : 1)}%` }}
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

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        {/* lista de estudios */}
        <section>
          <h2 className="text-base font-semibold text-foreground">
            {studios.length} {studios.length === 1 ? "estudio" : "estudios"}
          </h2>
          {studios.length > 0 ? (
            <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <div className="divide-y divide-border">
                {studios.map((s) => {
                  const c = counts.get(s.id) ?? { clients: 0, staff: 0 };
                  const active = s.status === "active";
                  const last = lastActivity.get(s.id);
                  const idleDays = last ? daysSince(last) : null;
                  const dormant = active && (idleDays === null || idleDays >= 14);
                  return (
                    <div
                      key={s.id}
                      className={`flex flex-wrap items-center gap-3 px-4 py-3 ${
                        studioFilter === s.id ? "bg-primary/5" : ""
                      }`}
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-primary-ink">
                        <Building2 className="size-4" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-semibold text-foreground">{s.name}</span>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                              active ? "bg-success/15 text-success" : "bg-warning/15 text-warning"
                            }`}
                          >
                            {active ? <CheckCircle2 className="size-3" aria-hidden /> : <PauseCircle className="size-3" aria-hidden />}
                            {active ? "Activo" : "Suspendido"}
                          </span>
                          {mpConnected.has(s.id) ? (
                            <span
                              title="Cobro online conectado (MercadoPago)"
                              className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                            >
                              <CreditCard className="size-3" aria-hidden />
                              MP
                            </span>
                          ) : null}
                          {dormant ? (
                            <span
                              title="Sin cobros ni reservas recientes"
                              className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-medium text-warning"
                            >
                              <Moon className="size-3" aria-hidden />
                              {idleDays === null ? "sin actividad 30d+" : `sin actividad ${idleDays}d`}
                            </span>
                          ) : null}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          /{s.slug} · desde {fmtDate(s.created_at)}
                        </p>
                      </div>
                      <span className="hidden shrink-0 items-center gap-3 text-xs text-muted-foreground sm:flex">
                        <span className="inline-flex items-center gap-1">
                          <Users className="size-3.5" aria-hidden />
                          {c.clients} {c.clients === 1 ? "alumno" : "alumnos"}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <GraduationCap className="size-3.5" aria-hidden />
                          {c.staff} staff
                        </span>
                        <span className="w-20 text-right font-medium tabular-nums text-foreground">
                          {money(gmvByStudio.get(s.id) ?? 0)}
                          <span className="block text-[10px] font-normal text-muted-foreground">{periodTitle}</span>
                        </span>
                      </span>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <Link
                          href={`/e/${s.slug}`}
                          target="_blank"
                          title="Ver landing pública"
                          className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                        >
                          <ExternalLink className="size-4" aria-hidden />
                        </Link>
                        <form action={toggleStudioStatus}>
                          <input type="hidden" name="studioId" value={s.id} />
                          <input type="hidden" name="next" value={active ? "suspended" : "active"} />
                          <button
                            type="submit"
                            title={active ? "Suspender" : "Reactivar"}
                            className={`flex size-8 items-center justify-center rounded-lg transition-colors ${
                              active
                                ? "text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                : "text-muted-foreground hover:bg-success/10 hover:text-success"
                            }`}
                          >
                            <Power className="size-4" aria-hidden />
                          </button>
                        </form>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="mt-3 rounded-2xl border border-dashed border-border bg-card/60 px-6 py-12 text-center">
              <Building2 className="mx-auto size-6 text-muted-foreground" aria-hidden />
              <p className="mt-3 text-sm text-muted-foreground">Todavía no hay estudios. Creá el primero.</p>
            </div>
          )}
        </section>

        {/* alta de estudio */}
        <aside className="lg:sticky lg:top-8">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary-ink">
                <Plus className="size-4" aria-hidden />
              </span>
              <h2 className="text-base font-semibold text-foreground">Nuevo estudio</h2>
            </div>
            <form action={createStudio} className="grid gap-4">
              <Field label="Nombre">
                <input name="name" required minLength={2} maxLength={80} placeholder="Estudio Armonía" className={inputCls} />
              </Field>
              <Field label="Slug (opcional, se deriva del nombre)">
                <input name="slug" pattern="[a-z0-9-]*" maxLength={60} placeholder="estudio-armonia" className={inputCls} />
              </Field>
              <div className="grid grid-cols-[1fr_auto] gap-3">
                <Field label="Zona horaria">
                  <input name="timezone" required defaultValue="America/Argentina/Buenos_Aires" className={inputCls} />
                </Field>
                <Field label="Acento">
                  <input
                    type="color"
                    name="accent"
                    defaultValue="#C8775A"
                    className="h-9 w-14 cursor-pointer rounded-md border border-input bg-card p-1"
                  />
                </Field>
              </div>

              <div className="border-t border-border pt-3">
                <p className="text-sm font-medium text-foreground">Dueño / admin del estudio</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Opcional: crea su usuario y queda como admin. Pasale vos las credenciales.
                </p>
              </div>
              <Field label="Nombre completo">
                <input name="admin_name" maxLength={80} placeholder="Nombre del dueño" className={inputCls} />
              </Field>
              <Field label="Email">
                <input type="email" name="admin_email" placeholder="dueno@estudio.com" className={inputCls} />
              </Field>
              <Field label="Clave temporal (mín. 8)">
                <input type="text" name="admin_password" minLength={8} maxLength={72} autoComplete="off" className={inputCls} />
              </Field>

              <SubmitButton />
            </form>
          </div>
        </aside>
      </div>
    </main>
  );
}
