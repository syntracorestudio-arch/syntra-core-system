import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CheckCircle2, XCircle, UserX, CalendarDays, History } from "lucide-react";
import { createSupabaseServer } from "@/lib/supabase/server";

export const metadata = { title: "Mi historial" };
export const dynamic = "force-dynamic";

const DEFAULT_TZ = "America/Argentina/Buenos_Aires";

const STATUS_META: Record<string, { label: string; cls: string; icon: typeof CheckCircle2 }> = {
  attended: { label: "Asististe", cls: "bg-success/15 text-success", icon: CheckCircle2 },
  no_show: { label: "Faltaste", cls: "bg-destructive/15 text-destructive", icon: UserX },
  cancelled: { label: "Cancelaste", cls: "bg-secondary text-muted-foreground", icon: XCircle },
  booked: { label: "Reservada", cls: "bg-primary/10 text-primary-ink", icon: CalendarDays },
};

function fmtDateTime(iso: string, tz: string) {
  const s = new Intl.DateTimeFormat("es-AR", {
    timeZone: tz,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
  return s.replace(/\./g, "");
}

type OccRel = { starts_at: string; classes: { name: string } | { name: string }[] | null };

export default async function HistorialPage() {
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

  // Mis reservas pasadas y su desenlace (RLS: propias). attendance para distinguir
  // "reservada sin cierre" de asistió/faltó cuando el estudio marcó.
  const { data: resRaw } = await supabase
    .from("class_reservations")
    .select("id, status, created_at, class_occurrences(starts_at, classes(name))")
    .order("created_at", { ascending: false })
    .limit(60);

  const nowIso = new Date().toISOString();
  const rows = ((resRaw ?? []) as { id: string; status: string; class_occurrences: OccRel | OccRel[] | null }[])
    .map((r) => {
      const o = Array.isArray(r.class_occurrences) ? r.class_occurrences[0] : r.class_occurrences;
      const cls = o ? (Array.isArray(o.classes) ? o.classes[0] : o.classes) : null;
      return {
        id: r.id,
        status: r.status,
        startsAt: o?.starts_at ?? null,
        name: cls?.name ?? "Clase",
      };
    })
    .filter((r) => r.startsAt && (r.status !== "booked" || (r.startsAt as string) < nowIso))
    .sort((a, b) => ((a.startsAt as string) < (b.startsAt as string) ? 1 : -1));

  const attended = rows.filter((r) => r.status === "attended").length;
  const noShows = rows.filter((r) => r.status === "no_show").length;

  return (
    <main className="canvas-aurora mx-auto min-h-dvh w-full max-w-2xl px-5 pb-16 pt-8 lg:px-8">
      <Link
        href="/app"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Volver
      </Link>
      <header className="mt-3 flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-2xl bg-accent text-primary-ink">
          <History className="size-5" aria-hidden />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Mi historial</h1>
          <p className="text-sm text-muted-foreground">
            {attended} {attended === 1 ? "clase tomada" : "clases tomadas"}
            {noShows > 0 ? ` · ${noShows} ${noShows === 1 ? "ausencia" : "ausencias"}` : ""}
          </p>
        </div>
      </header>

      {rows.length > 0 ? (
        <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <ul className="divide-y divide-border">
            {rows.map((r) => {
              const meta = STATUS_META[r.status] ?? STATUS_META.booked;
              const Icon = meta.icon;
              return (
                <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{r.name}</p>
                    <p className="text-xs capitalize text-muted-foreground">{fmtDateTime(r.startsAt as string, tz)}</p>
                  </div>
                  <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.cls}`}>
                    <Icon className="size-3.5" aria-hidden />
                    {r.status === "booked" ? "Sin registrar" : meta.label}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-dashed border-border bg-card/60 px-6 py-12 text-center">
          <CalendarDays className="mx-auto size-6 text-muted-foreground" aria-hidden />
          <p className="mt-3 text-sm text-muted-foreground">
            Todavía no tenés clases pasadas. Cuando tomes tu primera clase va a aparecer acá.
          </p>
        </div>
      )}
    </main>
  );
}
