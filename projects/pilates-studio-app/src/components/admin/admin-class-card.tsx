import { User2, CalendarDays, Repeat, Users, Archive, Pencil } from "lucide-react";
import { cancelClass } from "@/app/admin/clases/actions";

export type AdminClassData = {
  classId: string;
  name: string;
  instructor: string | null;
  capacity: number;
  durationMin: number | null;
  /** "recurring" si tiene reglas semanales; "once" si es una clase suelta. */
  kind: "recurring" | "once";
  /** Recurrente: días de la semana (0-6) ordenados. */
  weekdays: number[];
  /** Recurrente: hora HH:MM de la regla (la primera). Única: fecha+hora. */
  scheduleTime: string | null;
  /** Única: fecha legible (ej. "lun 30 jun"). */
  onceLabel: string | null;
  /** Cantidad de clases futuras programadas. */
  upcoming: number;
};

const WD_LABEL = ["D", "L", "M", "M", "J", "V", "S"]; // index = Postgres dow (0=Dom)
const WD_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function AdminClassCard({ data, editing = false }: { data: AdminClassData; editing?: boolean }) {
  const recurring = data.kind === "recurring";
  const Icon = recurring ? Repeat : CalendarDays;
  const days = WD_ORDER.filter((wd) => data.weekdays.includes(wd));

  return (
    <article
      className={`rounded-2xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5 ${
        editing ? "border-primary ring-2 ring-primary/30" : "border-border"
      }`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="flex flex-1 items-start gap-4">
          {/* hora destacada (ancla, igual que la card del alumno) */}
          <div className="flex min-w-16 flex-col">
            <span className="text-2xl font-bold leading-none tracking-tight text-foreground">
              {data.scheduleTime ?? "—"}
            </span>
            <span className="mt-1 text-xs capitalize text-muted-foreground">
              {recurring ? "cada semana" : (data.onceLabel ?? "")}
            </span>
          </div>

          {/* nombre + tipo + instructor + días/meta */}
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-foreground">{data.name}</h3>
              <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">
                <Icon className="size-3" aria-hidden />
                {recurring ? "Recurrente" : "Única"}
              </span>
            </div>

            {data.instructor ? (
              <p className="mt-1 inline-flex items-center gap-1 text-sm text-muted-foreground">
                <User2 className="size-3.5" aria-hidden />
                con {data.instructor}
              </p>
            ) : null}

            {/* días de la semana (recurrente) */}
            {recurring ? (
              <div className="mt-2 flex items-center gap-1.5">
                {WD_ORDER.map((wd) => {
                  const on = days.includes(wd);
                  return (
                    <span
                      key={wd}
                      className={`flex size-6 items-center justify-center rounded-full text-[11px] font-medium ${
                        on ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      {WD_LABEL[wd]}
                    </span>
                  );
                })}
              </div>
            ) : null}

            {/* meta */}
            <div className="mt-2.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Users className="size-3.5" aria-hidden />
                Cupo {data.capacity}
              </span>
              {data.durationMin ? <span>{data.durationMin} min</span> : null}
              <span>
                {data.upcoming} {data.upcoming === 1 ? "clase próxima" : "clases próximas"}
              </span>
            </div>
          </div>
        </div>

        {/* acciones: editar (rellena el panel) + archivar (soft-delete reversible) */}
        <div className="flex gap-2 sm:w-40 sm:shrink-0 sm:flex-col">
          <a
            href={`/admin/clases?edit=${data.classId}#nueva-clase`}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
          >
            <Pencil className="size-4" aria-hidden />
            Editar
          </a>
          <form action={cancelClass} className="flex-1">
            <input type="hidden" name="class" value={data.classId} />
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <Archive className="size-4" aria-hidden />
              Archivar
            </button>
          </form>
        </div>
      </div>
    </article>
  );
}
