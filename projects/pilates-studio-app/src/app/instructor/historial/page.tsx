import { redirect } from "next/navigation";
import { History, CalendarDays } from "lucide-react";
import { createSupabaseServer } from "@/lib/supabase/server";

export const metadata = { title: "Clases dadas — Instructor" };
export const dynamic = "force-dynamic";

const DEFAULT_TZ = "America/Argentina/Buenos_Aires";

type ResRel = { status: string };
type OccRow = {
  id: string;
  starts_at: string;
  classes: { name: string } | { name: string }[] | null;
  class_reservations: ResRel[] | null;
};

/**
 * Historial de clases dadas (últimos 60 días): la contracara verificable del pago
 * por clase — el instructor puede contrastar sus clases sin ver tarifas de nadie.
 */
export default async function InstructorHistorialPage() {
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
  const fromIso = new Date(now.getTime() - 60 * 86_400_000).toISOString();

  const { data: occRaw } = await supabase
    .from("class_occurrences")
    .select("id, starts_at, classes!inner(name, instructor_id), class_reservations(status)")
    .eq("status", "scheduled")
    .gte("starts_at", fromIso)
    .lt("starts_at", nowIso)
    .eq("classes.instructor_id", me.id)
    .order("starts_at", { ascending: false })
    .limit(120);

  const rows = ((occRaw ?? []) as unknown as OccRow[]).map((o) => {
    const cls = Array.isArray(o.classes) ? o.classes[0] : o.classes;
    const res = (o.class_reservations ?? []).filter((r) => r.status !== "cancelled");
    return {
      id: o.id,
      startsAt: o.starts_at,
      name: cls?.name ?? "Clase",
      attended: res.filter((r) => r.status === "attended").length,
      total: res.length,
      unmarked: res.filter((r) => r.status === "booked").length,
    };
  });

  // Agrupar por mes local (título de sección)
  const monthOf = (iso: string) =>
    new Intl.DateTimeFormat("es-AR", { timeZone: tz, month: "long", year: "numeric" }).format(new Date(iso));
  const groups: { label: string; items: typeof rows }[] = [];
  for (const r of rows) {
    const label = monthOf(r.startsAt);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(r);
    else groups.push({ label, items: [r] });
  }
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat("es-AR", {
      timeZone: tz,
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .format(new Date(iso))
      .replace(/\./g, "");

  return (
    <main className="mx-auto min-h-dvh w-full max-w-3xl px-5 pb-16 pt-8 lg:px-8">
      <header className="flex items-center justify-between gap-4 rounded-3xl border border-border bg-gradient-to-br from-accent/70 via-card to-card p-5 shadow-sm duration-500 animate-in fade-in slide-in-from-bottom-2 sm:p-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Clases dadas</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Últimos 60 días · {rows.length} {rows.length === 1 ? "clase" : "clases"}
          </p>
        </div>
        <span className="hidden size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary-ink sm:flex">
          <History className="size-5" aria-hidden />
        </span>
      </header>

      {rows.length > 0 ? (
        <div className="mt-6 grid gap-5">
          {groups.map((g) => (
            <section key={g.label}>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <span className="capitalize">{g.label}</span>
              </h2>
              <div className="mt-2 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                <ul className="divide-y divide-border">
                  {g.items.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{r.name}</p>
                        <p className="text-xs capitalize text-muted-foreground">{fmt(r.startsAt)}</p>
                      </div>
                      {r.unmarked > 0 ? (
                        <a
                          href={`/instructor?occ=${r.id}`}
                          className="shrink-0 rounded-full border border-warning/40 bg-warning/10 px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-warning/15"
                        >
                          {r.unmarked} sin marcar
                        </a>
                      ) : (
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                          {r.attended}/{r.total} presentes
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="mt-8 rounded-2xl border border-dashed border-border bg-card/60 px-6 py-14 text-center">
          <CalendarDays className="mx-auto size-6 text-muted-foreground" aria-hidden />
          <p className="mt-3 text-sm text-muted-foreground">Todavía no diste clases. Tu historial va a aparecer acá.</p>
        </div>
      )}
    </main>
  );
}
