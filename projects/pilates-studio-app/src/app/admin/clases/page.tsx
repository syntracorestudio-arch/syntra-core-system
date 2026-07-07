import { redirect } from "next/navigation";
import { LogOut, Plus, Pencil, LayoutGrid } from "lucide-react";
import { createSupabaseServer } from "@/lib/supabase/server";
import { ClassForm, type ClassFormInitial, type InstructorOption } from "@/components/admin/class-form";
import { AdminClassCard, type AdminClassData } from "@/components/admin/admin-class-card";
import { AdminTabs } from "@/components/admin/admin-tabs";

export const metadata = { title: "Clases — Panel" };
export const dynamic = "force-dynamic";

const ADMIN_ROLES = ["admin", "reception"];
const DEFAULT_TZ = "America/Argentina/Buenos_Aires";

/** Fecha legible local del estudio para una clase única (ej. "lun 30 jun"). */
function onceLabel(iso: string, tz: string) {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: tz,
    weekday: "short",
    day: "numeric",
    month: "short",
  })
    .format(new Date(iso))
    .replace(/\./g, "");
}

/** Hora HH:MM local del estudio. */
function localTime(iso: string, tz: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(iso))
      .map((x) => [x.type, x.value]),
  );
  return `${p.hour}:${p.minute}`;
}

/** Fecha YYYY-MM-DD local del estudio (para prefill de inputs date en edición). */
function localDate(iso: string, tz: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(new Date(iso))
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}`;
}

type StudioRel = { name: string; timezone: string | null };
type Schedule = { weekday: number; start_time: string; valid_from: string; valid_to: string | null };
type Occurrence = { id: string; starts_at: string; status: string };
type ClassRow = {
  id: string;
  name: string;
  instructor_name: string | null;
  instructor_id: string | null;
  default_capacity: number;
  duration_min: number | null;
  class_schedules: Schedule[] | null;
  class_occurrences: Occurrence[] | null;
};
type InstructorRow = { id: string; profiles: { full_name: string } | { full_name: string }[] | null };

export default async function AdminClasesPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string; edit?: string }>;
}) {
  const { notice, error, edit } = await searchParams;
  const supabase = await createSupabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Vínculo + rol + estudio (RLS: el actor ve su propio member)
  const { data: member } = await supabase
    .from("members")
    .select("role, studios(name, timezone)")
    .limit(1)
    .maybeSingle();
  if (!member || !ADMIN_ROLES.includes(member.role)) redirect("/app");

  const studioRel = (member.studios ?? null) as StudioRel | StudioRel[] | null;
  const studio = Array.isArray(studioRel) ? studioRel[0] : studioRel;
  const tz = studio?.timezone || DEFAULT_TZ;

  const nowIso = new Date().toISOString();

  const [{ data: rows }, { data: insRows }] = await Promise.all([
    supabase
      .from("classes")
      .select(
        "id, name, instructor_name, instructor_id, default_capacity, duration_min, " +
          "class_schedules(weekday, start_time, valid_from, valid_to), class_occurrences(id, starts_at, status)",
      )
      .eq("status", "active")
      .order("created_at", { ascending: false }),
    supabase.from("members").select("id, profiles(full_name)").eq("role", "instructor"),
  ]);

  const instructors: InstructorOption[] = ((insRows ?? []) as unknown as InstructorRow[])
    .map((m) => {
      const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
      return { id: m.id, name: p?.full_name ?? "Instructor" };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "es"));

  const classes: AdminClassData[] = ((rows ?? []) as unknown as ClassRow[]).map((r) => {
    const schedules = r.class_schedules ?? [];
    const occ = r.class_occurrences ?? [];
    const upcoming = occ.filter((o) => o.status === "scheduled" && o.starts_at > nowIso).length;
    const recurring = schedules.length > 0;

    // hora a mostrar
    let scheduleTime: string | null = null;
    let onceLbl: string | null = null;
    let weekdays: number[] = [];
    if (recurring) {
      weekdays = [...new Set(schedules.map((s) => s.weekday))];
      scheduleTime = schedules[0]?.start_time?.slice(0, 5) ?? null;
    } else {
      const next = occ
        .filter((o) => o.status === "scheduled")
        .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
      if (next) {
        onceLbl = onceLabel(next.starts_at, tz);
        scheduleTime = localTime(next.starts_at, tz);
      }
    }

    return {
      classId: r.id,
      name: r.name,
      instructor: r.instructor_name,
      capacity: r.default_capacity,
      durationMin: r.duration_min,
      kind: recurring ? "recurring" : "once",
      weekdays,
      scheduleTime,
      onceLabel: onceLbl,
      upcoming,
    };
  });

  // Modo edición: ?edit=<classId> sobre una clase activa → prefill del panel.
  const editId = edit && classes.some((c) => c.classId === edit) ? edit : null;
  let initial: ClassFormInitial | null = null;
  if (editId) {
    const row = ((rows ?? []) as unknown as ClassRow[]).find((r) => r.id === editId)!;
    const schedules = row.class_schedules ?? [];
    const base = {
      classId: row.id,
      name: row.name,
      instructorId: row.instructor_id ?? "",
      capacity: row.default_capacity,
      duration: row.duration_min ?? 60,
    };
    if (schedules.length > 0) {
      initial = {
        ...base,
        kind: "recurring",
        date: "",
        time: schedules[0].start_time.slice(0, 5),
        weekdays: [...new Set(schedules.map((s) => s.weekday))],
        validFrom: schedules[0].valid_from,
        validTo: schedules[0].valid_to ?? "",
      };
    } else {
      const next = (row.class_occurrences ?? [])
        .filter((o) => o.status === "scheduled")
        .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
      initial = {
        ...base,
        kind: "once",
        date: next ? localDate(next.starts_at, tz) : "",
        time: next ? localTime(next.starts_at, tz) : "18:00",
        weekdays: [],
        validFrom: "",
        validTo: "",
      };
    }
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-6xl px-5 pb-16 pt-8 lg:px-8">
      {/* header */}
      <header className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{studio?.name ?? "Tu estudio"}</p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Clases</h1>
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

      <AdminTabs active="clases" />

      {/* avisos */}
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

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        {/* lista de clases (primero en mobile y en desktop, columna izquierda) */}
        <section>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-foreground">
              {classes.length > 0
                ? `${classes.length} ${classes.length === 1 ? "clase activa" : "clases activas"}`
                : "Clases"}
            </h2>
            {/* CTA dominante en mobile → ancla al panel de creación */}
            <a
              href="#nueva-clase"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:opacity-90 lg:hidden"
            >
              <Plus className="size-4" aria-hidden />
              Nueva clase
            </a>
          </div>
          <div className="mt-3 grid gap-3">
            {classes.length > 0 ? (
              classes.map((c, i) => (
                <div
                  key={c.classId}
                  style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
                  className="animate-in fade-in slide-in-from-bottom-2 duration-500 [animation-fill-mode:backwards]"
                >
                  <AdminClassCard data={c} editing={c.classId === editId} />
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-border bg-card/60 px-6 py-12 text-center">
                <LayoutGrid className="mx-auto size-6 text-muted-foreground" aria-hidden />
                <p className="mt-3 text-sm text-muted-foreground">
                  Todavía no creaste clases. Creá la primera con el panel de abajo.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* panel de creación (debajo en mobile, columna derecha fija en desktop) */}
        <aside id="nueva-clase" className="scroll-mt-8 lg:sticky lg:top-8">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                {initial ? <Pencil className="size-4" aria-hidden /> : <Plus className="size-4" aria-hidden />}
              </span>
              <h2 className="text-base font-semibold text-foreground">
                {initial ? "Editar clase" : "Nueva clase"}
              </h2>
            </div>
            <ClassForm key={initial?.classId ?? "new"} initial={initial} instructors={instructors} />
          </div>
        </aside>
      </div>
    </main>
  );
}
