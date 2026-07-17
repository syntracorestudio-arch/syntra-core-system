import { redirect } from "next/navigation";
import { BarChart3, Users, Wallet, CalendarDays } from "lucide-react";
import { createSupabaseServer } from "@/lib/supabase/server";
import { RadialGauge } from "@/components/admin/radial-gauge";

export const metadata = { title: "Mi mes — Instructor" };
export const dynamic = "force-dynamic";

const DEFAULT_TZ = "America/Argentina/Buenos_Aires";

function money(n: number) {
  return `$${Number(n).toLocaleString("es-AR")}`;
}
function localMonth(iso: string, tz: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit" }).format(new Date(iso));
}

type ResRel = { status: string; member_id: string };
type OccRow = {
  id: string;
  starts_at: string;
  classes: { name: string } | { name: string }[] | null;
  class_reservations: ResRel[] | null;
};

/** Métricas personales del mes del instructor: solo agregados PROPIOS (nunca de otros). */
export default async function InstructorMesPage() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("members")
    .select("id, role, studios(timezone)")
    .eq("profile_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!me) redirect("/login");
  if (me.role !== "instructor") redirect(me.role === "admin" || me.role === "reception" ? "/admin" : "/app");

  const sRel = (me.studios ?? null) as { timezone: string | null } | { timezone: string | null }[] | null;
  const tz = (Array.isArray(sRel) ? sRel[0] : sRel)?.timezone || DEFAULT_TZ;
  const now = new Date();
  const nowIso = now.toISOString();
  const monthKey = localMonth(nowIso, tz);
  // Desde el 1° del mes local, con margen de tz (filtramos por mes local después)
  const fromIso = new Date(now.getTime() - 35 * 86_400_000).toISOString();

  const [{ data: occRaw }, { data: payRows }] = await Promise.all([
    supabase
      .from("class_occurrences")
      .select("id, starts_at, classes!inner(name, instructor_id), class_reservations(status, member_id)")
      .eq("status", "scheduled")
      .gte("starts_at", fromIso)
      .lt("starts_at", nowIso)
      .eq("classes.instructor_id", me.id)
      .order("starts_at", { ascending: false })
      .limit(120),
    supabase.rpc("instructor_month_pay"),
  ]);

  const monthOccs = ((occRaw ?? []) as unknown as OccRow[])
    .filter((o) => localMonth(o.starts_at, tz) === monthKey)
    .map((o) => {
      const cls = Array.isArray(o.classes) ? o.classes[0] : o.classes;
      const res = (o.class_reservations ?? []).filter((r) => r.status !== "cancelled");
      return {
        name: cls?.name ?? "Clase",
        reservations: res,
        attended: res.filter((r) => r.status === "attended").length,
        marked: res.filter((r) => r.status !== "booked").length,
      };
    });

  const clasesDadas = monthOccs.length;
  const alumnosUnicos = new Set(monthOccs.flatMap((o) => o.reservations.map((r) => r.member_id))).size;
  const marked = monthOccs.reduce((a, o) => a + o.marked, 0);
  const asistencia = marked > 0 ? Math.round((monthOccs.reduce((a, o) => a + o.attended, 0) / marked) * 100) : null;
  const monthLabel = new Intl.DateTimeFormat("es-AR", { timeZone: tz, month: "long", year: "numeric" }).format(now);

  // Desglose por clase (qué dicté y cuánto)
  const byClass = new Map<string, number>();
  for (const o of monthOccs) byClass.set(o.name, (byClass.get(o.name) ?? 0) + 1);
  const breakdown = [...byClass.entries()].sort((a, b) => b[1] - a[1]);

  const pay =
    (((payRows ?? []) as { mode: string; amount: number; classes_count: number; estimated: number }[])[0] as
      | { mode: string; amount: number; classes_count: number; estimated: number }
      | undefined) ?? null;

  return (
    <main className="mx-auto min-h-dvh w-full max-w-5xl px-5 pb-16 pt-8 lg:px-8">
      <header className="flex items-center justify-between gap-4 rounded-3xl border border-border bg-gradient-to-br from-accent/70 via-card to-card p-5 shadow-sm duration-500 animate-in fade-in slide-in-from-bottom-2 sm:p-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Mi mes</h1>
          <p className="mt-0.5 text-sm capitalize text-muted-foreground">{monthLabel}</p>
        </div>
        <span className="hidden size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary-ink sm:flex">
          <BarChart3 className="size-5" aria-hidden />
        </span>
      </header>

      {clasesDadas > 0 ? (
        <>
          <dl className={`mt-6 grid grid-cols-2 gap-3 ${pay ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}>
            <div className="rounded-xl border border-border bg-card px-4 py-3 shadow-sm duration-500 animate-in fade-in slide-in-from-bottom-2 [animation-fill-mode:backwards]">
              <dt className="flex items-center gap-1 text-xs text-muted-foreground">
                <CalendarDays className="size-3.5" aria-hidden />
                Clases dadas
              </dt>
              <dd className="mt-0.5 text-2xl font-bold tabular-nums text-foreground">{clasesDadas}</dd>
            </div>
            <div
              style={{ animationDelay: "60ms" }}
              className="rounded-xl border border-border bg-card px-4 py-3 shadow-sm duration-500 animate-in fade-in slide-in-from-bottom-2 [animation-fill-mode:backwards]"
            >
              <dt className="flex items-center gap-1 text-xs text-muted-foreground">
                <Users className="size-3.5" aria-hidden />
                Alumnos únicos
              </dt>
              <dd className="mt-0.5 text-2xl font-bold tabular-nums text-foreground">{alumnosUnicos}</dd>
            </div>
            <div
              style={{ animationDelay: "120ms" }}
              className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 shadow-sm duration-500 animate-in fade-in slide-in-from-bottom-2 [animation-fill-mode:backwards]"
            >
              <div>
                <dt className="text-xs text-muted-foreground">Asistencia</dt>
                <dd className="mt-0.5 text-2xl font-bold tabular-nums text-foreground">
                  {asistencia !== null ? `${asistencia}%` : "—"}
                </dd>
              </div>
              {asistencia !== null ? <RadialGauge pct={asistencia} size={48} stroke={5} className="text-primary" /> : null}
            </div>
            {pay ? (
              <div
                style={{ animationDelay: "180ms" }}
                className="rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 shadow-sm duration-500 animate-in fade-in slide-in-from-bottom-2 [animation-fill-mode:backwards]"
              >
                <dt className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Wallet className="size-3" aria-hidden />
                  {pay.mode === "per_class" ? "Estimado del mes" : pay.mode === "fixed_weekly" ? "Tu tarifa semanal" : "Tu tarifa mensual"}
                </dt>
                <dd className="mt-0.5 text-2xl font-bold tabular-nums text-foreground">{money(pay.estimated)}</dd>
                {pay.mode === "per_class" ? (
                  <p className="text-[11px] text-muted-foreground">
                    {money(pay.amount)} × {pay.classes_count} {pay.classes_count === 1 ? "clase" : "clases"} · orientativo
                  </p>
                ) : null}
              </div>
            ) : null}
          </dl>

          {/* desglose: qué dicté este mes */}
          <section className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-foreground">Qué dictaste este mes</h2>
            <ul className="mt-3 grid gap-2">
              {breakdown.map(([name, count]) => {
                const pct = Math.round((count / clasesDadas) * 100);
                return (
                  <li key={name} className="grid grid-cols-[1fr_auto] items-center gap-3">
                    <div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-foreground">{name}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {count} {count === 1 ? "clase" : "clases"}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-sunken">
                        <div className="anim-grow-x h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      ) : (
        <div className="mt-8 rounded-2xl border border-dashed border-border bg-card/60 px-6 py-14 text-center">
          <BarChart3 className="mx-auto size-6 text-muted-foreground" aria-hidden />
          <p className="mt-3 text-sm text-muted-foreground">
            Todavía no diste clases este mes. Cuando des la primera, tus números aparecen acá.
          </p>
        </div>
      )}
    </main>
  );
}
