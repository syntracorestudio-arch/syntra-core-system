import { redirect } from "next/navigation";
import {
  CalendarCheck,
  CalendarPlus,
  CheckCircle2,
  XCircle,
  UserX,
  CalendarDays,
  Hourglass,
  Sparkles,
} from "lucide-react";
import { createSupabaseServer } from "@/lib/supabase/server";
import { cancelReservation, leaveWaitlist } from "../actions";

export const metadata = { title: "Mi actividad" };
export const dynamic = "force-dynamic";

const DEFAULT_TZ = "America/Argentina/Buenos_Aires";

const STATUS_META: Record<string, { label: string; cls: string; icon: typeof CheckCircle2 }> = {
  attended: { label: "Asististe", cls: "bg-success/15 text-success", icon: CheckCircle2 },
  no_show: { label: "Faltaste", cls: "bg-destructive/15 text-destructive", icon: UserX },
  cancelled: { label: "Cancelaste", cls: "bg-secondary text-muted-foreground", icon: XCircle },
  booked: { label: "Sin registrar", cls: "bg-secondary text-muted-foreground", icon: CalendarDays },
};

function fmtDateTime(iso: string, tz: string) {
  return new Intl.DateTimeFormat("es-AR", {
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
}
function dayKey(iso: string, tz: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(iso),
  );
}

type OccRel = {
  starts_at: string;
  classes: { name: string; instructor_name?: string | null } | { name: string; instructor_name?: string | null }[] | null;
};
const relOcc = (o: OccRel | OccRel[] | null) => (Array.isArray(o) ? o[0] : o) ?? null;
const relCls = (o: OccRel | null) => (o ? ((Array.isArray(o.classes) ? o.classes[0] : o.classes) ?? null) : null);

export default async function ActividadPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const { notice, error } = await searchParams;
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: member } = await supabase
    .from("members")
    .select("id, studios(timezone)")
    .eq("profile_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!member) redirect("/login");
  const sRel = (member.studios ?? null) as { timezone: string | null } | { timezone: string | null }[] | null;
  const tz = (Array.isArray(sRel) ? sRel[0] : sRel)?.timezone || DEFAULT_TZ;
  const nowIso = new Date().toISOString();

  // Reservas activas futuras + waitlist + historial (RLS: propias)
  const [{ data: bookedRaw }, { data: waitRaw }, { data: histRaw }] = await Promise.all([
    supabase
      .from("class_reservations")
      .select("id, occurrence_id, promoted, class_occurrences(starts_at, classes(name, instructor_name))")
      .eq("status", "booked"),
    supabase
      .from("waitlist")
      .select("occurrence_id, position, class_occurrences(starts_at, classes(name, instructor_name))")
      .eq("status", "waiting"),
    supabase
      .from("class_reservations")
      .select("id, status, created_at, class_occurrences(starts_at, classes(name))")
      .order("created_at", { ascending: false })
      .limit(60),
  ]);

  const upcoming = ((bookedRaw ?? []) as { id: string; occurrence_id: string; promoted: boolean | null; class_occurrences: OccRel | OccRel[] | null }[])
    .map((r) => {
      const o = relOcc(r.class_occurrences);
      const c = relCls(o);
      return {
        id: r.id,
        occurrenceId: r.occurrence_id,
        promoted: Boolean(r.promoted),
        startsAt: o?.starts_at ?? null,
        name: c?.name ?? "Clase",
        instructor: c?.instructor_name ?? null,
      };
    })
    .filter((r) => r.startsAt && r.startsAt > nowIso)
    .sort((a, b) => ((a.startsAt as string) < (b.startsAt as string) ? -1 : 1));

  const waiting = ((waitRaw ?? []) as { occurrence_id: string; position: number; class_occurrences: OccRel | OccRel[] | null }[])
    .map((w) => {
      const o = relOcc(w.class_occurrences);
      const c = relCls(o);
      return {
        occurrenceId: w.occurrence_id,
        position: w.position,
        startsAt: o?.starts_at ?? null,
        name: c?.name ?? "Clase",
      };
    })
    .filter((w) => w.startsAt && w.startsAt > nowIso)
    .sort((a, b) => ((a.startsAt as string) < (b.startsAt as string) ? -1 : 1));

  const history = ((histRaw ?? []) as { id: string; status: string; class_occurrences: OccRel | OccRel[] | null }[])
    .map((r) => {
      const o = relOcc(r.class_occurrences);
      const c = relCls(o);
      return { id: r.id, status: r.status, startsAt: o?.starts_at ?? null, name: c?.name ?? "Clase" };
    })
    .filter((r) => r.startsAt && (r.status !== "booked" || (r.startsAt as string) < nowIso))
    .sort((a, b) => ((a.startsAt as string) < (b.startsAt as string) ? 1 : -1));

  const attended = history.filter((r) => r.status === "attended").length;
  const noShows = history.filter((r) => r.status === "no_show").length;
  const monthKey = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit" })
    .format(new Date())
    .slice(0, 7);
  const attendedMonth = history.filter(
    (r) => r.status === "attended" && dayKey(r.startsAt as string, tz).slice(0, 7) === monthKey,
  ).length;

  return (
    <main className="mx-auto min-h-dvh w-full max-w-3xl px-5 pb-16 pt-8 lg:px-8">
      <header className="flex items-center justify-between gap-4 rounded-3xl border border-border bg-gradient-to-br from-accent/70 via-card to-card p-5 shadow-sm duration-500 animate-in fade-in slide-in-from-bottom-2 sm:p-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Mi actividad</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {attended > 0
              ? `${attended} ${attended === 1 ? "clase tomada" : "clases tomadas"}${attendedMonth > 0 ? ` · ${attendedMonth} este mes` : ""}${noShows > 0 ? ` · ${noShows} ${noShows === 1 ? "ausencia" : "ausencias"}` : ""}`
              : "Tus reservas, tu lista de espera y tu historial."}
          </p>
        </div>
        <span className="hidden size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary-ink sm:flex">
          <CalendarCheck className="size-5" aria-hidden />
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

      {/* próximas reservas */}
      <section className="mt-6">
        <h2 className="text-base font-semibold text-foreground">Próximas reservas</h2>
        {upcoming.length > 0 ? (
          <ul className="mt-3 grid gap-3">
            {upcoming.map((r, i) => (
              <li
                key={r.id}
                style={{ animationDelay: `${Math.min(i, 6) * 50}ms` }}
                className="relative overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-sm duration-500 animate-in fade-in slide-in-from-bottom-2 [animation-fill-mode:backwards] sm:p-5"
              >
                <span aria-hidden className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-primary" />
                <div className="flex flex-wrap items-center justify-between gap-3 pl-2">
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-foreground">
                      {r.name}
                      {r.instructor ? <span className="font-normal text-muted-foreground"> · {r.instructor}</span> : null}
                    </p>
                    <p className="text-sm capitalize text-muted-foreground">{fmtDateTime(r.startsAt as string, tz)}</p>
                    {r.promoted ? (
                      <p className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-primary-ink">
                        <Sparkles className="size-3" aria-hidden />
                        Promovida de la lista — cancelás sin costo hasta el inicio
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <a
                      href={`/app/calendario/${r.occurrenceId}`}
                      className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
                    >
                      <CalendarPlus className="size-3.5" aria-hidden />
                      Agendar
                    </a>
                    <a
                      href={`/app?day=${dayKey(r.startsAt as string, tz)}`}
                      className="inline-flex items-center rounded-full border border-border px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
                    >
                      ver el día
                    </a>
                    <form action={cancelReservation}>
                      <input type="hidden" name="res" value={r.id} />
                      <input type="hidden" name="from" value="/app/actividad" />
                      <button
                        type="submit"
                        className="rounded-full px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-destructive"
                      >
                        Cancelar
                      </button>
                    </form>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-3 rounded-2xl border border-dashed border-border bg-card/60 px-6 py-10 text-center">
            <CalendarDays className="mx-auto size-6 text-muted-foreground" aria-hidden />
            <p className="mt-3 text-sm text-muted-foreground">No tenés reservas próximas.</p>
            <a href="/app" className="mt-2 inline-block text-sm font-semibold text-primary-ink hover:underline">
              reservar una clase →
            </a>
          </div>
        )}
      </section>

      {/* lista de espera */}
      {waiting.length > 0 ? (
        <section className="mt-6">
          <h2 className="text-base font-semibold text-foreground">En lista de espera</h2>
          <ul className="mt-3 grid gap-3">
            {waiting.map((w) => (
              <li
                key={w.occurrenceId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5"
              >
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-foreground">{w.name}</p>
                  <p className="text-sm capitalize text-muted-foreground">{fmtDateTime(w.startsAt as string, tz)}</p>
                  <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-warning">
                    <Hourglass className="size-3" aria-hidden />
                    Puesto {w.position} — si se libera un lugar, tu reserva se confirma sola
                  </p>
                </div>
                <form action={leaveWaitlist}>
                  <input type="hidden" name="occ" value={w.occurrenceId} />
                  <input type="hidden" name="from" value="/app/actividad" />
                  <button
                    type="submit"
                    className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  >
                    Salir de la lista
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* historial */}
      <section className="mt-6">
        <h2 className="text-base font-semibold text-foreground">Historial</h2>
        {history.length > 0 ? (
          <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <ul className="divide-y divide-border">
              {history.map((r) => {
                const meta = STATUS_META[r.status] ?? STATUS_META.booked;
                const Icon = meta.icon;
                return (
                  <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{r.name}</p>
                      <p className="text-xs capitalize text-muted-foreground">{fmtDateTime(r.startsAt as string, tz)}</p>
                    </div>
                    <span
                      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.cls}`}
                    >
                      <Icon className="size-3.5" aria-hidden />
                      {meta.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <div className="mt-3 rounded-2xl border border-dashed border-border bg-card/60 px-6 py-10 text-center">
            <CalendarDays className="mx-auto size-6 text-muted-foreground" aria-hidden />
            <p className="mt-3 text-sm text-muted-foreground">
              Todavía no tenés clases pasadas. Cuando tomes tu primera clase va a aparecer acá.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
