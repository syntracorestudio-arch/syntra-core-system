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
} from "lucide-react";
import { requireSuperadmin } from "@/lib/superadmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { IconChip } from "@/components/ui/icon-chip";
import { createStudio, toggleStudioStatus } from "./actions";
import { SubmitButton } from "./submit-button";

export const metadata = { title: "Estudios — Superadmin" };
export const dynamic = "force-dynamic";

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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="font-medium text-foreground">{label}</span>
      {children}
    </label>
  );
}

function money(n: number) {
  return `$${Math.round(n).toLocaleString("es-AR")}`;
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
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const { notice, error } = await searchParams;
  await requireSuperadmin();

  // Ventanas de tiempo (AR es UTC-3 sin DST → el inicio de mes local es a las 03:00Z).
  const now = new Date();
  const nowIso = now.toISOString();
  const ymAr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
  })
    .format(now)
    .slice(0, 7);
  const monthStartIso = `${ymAr}-01T03:00:00.000Z`;
  const weekEndIso = new Date(now.getTime() + 7 * 86_400_000).toISOString();

  // Datos globales vía service-role (el gate ya validó superadmin).
  const admin = createAdminClient();
  const [{ data: studiosRaw }, { data: membersRaw }, { data: paysRaw }, { data: occRaw }] = await Promise.all([
    admin.from("studios").select("id, name, slug, status, timezone, created_at").order("created_at", { ascending: false }),
    admin.from("members").select("studio_id, role, status"),
    admin.from("payments").select("studio_id, amount").eq("status", "confirmed").gte("paid_at", monthStartIso),
    admin
      .from("class_occurrences")
      .select("booked_count, capacity")
      .eq("status", "scheduled")
      .gte("starts_at", nowIso)
      .lt("starts_at", weekEndIso),
  ]);
  const studios = (studiosRaw ?? []) as StudioRow[];
  const members = (membersRaw ?? []) as { studio_id: string; role: string; status: string }[];
  const monthPays = (paysRaw ?? []) as { studio_id: string; amount: number }[];
  const weekOccs = (occRaw ?? []) as { booked_count: number; capacity: number }[];

  const counts = new Map<string, { clients: number; staff: number }>();
  for (const m of members) {
    if (m.status !== "active") continue;
    const c = counts.get(m.studio_id) ?? { clients: 0, staff: 0 };
    if (m.role === "client") c.clients += 1;
    else c.staff += 1;
    counts.set(m.studio_id, c);
  }

  // Métricas globales del SaaS
  const activeStudios = studios.filter((s) => s.status === "active").length;
  const suspendedStudios = studios.length - activeStudios;
  const totalClients = [...counts.values()].reduce((s, c) => s + c.clients, 0);
  const totalStaff = [...counts.values()].reduce((s, c) => s + c.staff, 0);
  const gmvMes = monthPays.reduce((s, p) => s + Number(p.amount), 0);
  const gmvByStudio = new Map<string, number>();
  for (const p of monthPays) gmvByStudio.set(p.studio_id, (gmvByStudio.get(p.studio_id) ?? 0) + Number(p.amount));
  const weekBooked = weekOccs.reduce((s, o) => s + o.booked_count, 0);
  const weekCap = weekOccs.reduce((s, o) => s + o.capacity, 0);
  const weekPct = weekCap > 0 ? Math.round((weekBooked / weekCap) * 100) : 0;
  const monthLabel = new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    month: "long",
  }).format(now);

  const fmtDate = (iso: string) =>
    new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso));

  return (
    <main className="mx-auto min-h-dvh w-full max-w-6xl px-5 pb-16 pt-8 lg:px-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Estudios</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Alta y gestión de los estudios de la plataforma.
        </p>
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

      {/* ── Métricas globales del SaaS ── */}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric
          icon={<Wallet className="size-4" aria-hidden />}
          label={`Volumen de ${monthLabel}`}
          value={money(gmvMes)}
          detail={`${monthPays.length} ${monthPays.length === 1 ? "cobro" : "cobros"} en la plataforma`}
          hero
        />
        <Metric
          icon={<Building2 className="size-4" aria-hidden />}
          label="Estudios activos"
          value={String(activeStudios)}
          detail={suspendedStudios > 0 ? `${suspendedStudios} suspendido${suspendedStudios === 1 ? "" : "s"}` : "todos operando"}
        />
        <Metric
          icon={<Users className="size-4" aria-hidden />}
          label="Alumnos activos"
          value={String(totalClients)}
          detail={`+ ${totalStaff} staff`}
        />
        <Metric
          icon={<CalendarDays className="size-4" aria-hidden />}
          label="Reservas próximos 7 días"
          value={String(weekBooked)}
          detail={weekCap > 0 ? `${weekPct}% de ocupación global` : "sin clases programadas"}
        />
      </div>

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
                  return (
                    <div key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
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
                          <span className="block text-[10px] font-normal text-muted-foreground">este mes</span>
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
