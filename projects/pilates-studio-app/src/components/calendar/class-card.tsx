import { User2 } from "lucide-react";
import { reserve, joinWaitlist, cancelReservation, leaveWaitlist } from "@/app/app/actions";

export type ClassCardData = {
  occurrenceId: string;
  time: string; // "18:00"
  durationMin: number | null;
  name: string;
  instructor: string | null;
  capacity: number;
  booked: number;
  /** id de la reserva propia si el alumno ya reservó esta clase */
  myReservationId: string | null;
  isWaiting: boolean;
  /** posición en la lista de espera (si está anotado) */
  waitPosition: number | null;
  /** cuántos esperan un lugar en esta clase (0 si nadie) */
  waitingCount: number;
  /** aviso de ventana de cancelación para MI reserva ("sin costo hasta…" / fuera de ventana) */
  cancelHint: string | null;
};

type CupoState = "reserved" | "waiting" | "full" | "few" | "open";

function cupoState(d: ClassCardData): CupoState {
  if (d.myReservationId) return "reserved";
  if (d.isWaiting) return "waiting";
  const available = d.capacity - d.booked;
  if (available <= 0) return "full";
  if (available <= 2) return "few";
  return "open";
}

/** Estado de cupo: color (punto + tinte) + TEXTO en color oscuro → inequívoco y con contraste AA. */
const BADGE: Record<CupoState, { text: string; tint: string; dot: string }> = {
  reserved: { text: "Reservado", tint: "bg-success/10", dot: "bg-success" },
  waiting: { text: "En lista de espera", tint: "bg-warning/10", dot: "bg-warning" },
  full: { text: "Lleno", tint: "bg-destructive/10", dot: "bg-destructive" },
  few: { text: "Últimos lugares", tint: "bg-warning/10", dot: "bg-warning" },
  open: { text: "Disponible", tint: "bg-success/10", dot: "bg-success" },
};

export function ClassCard({
  data,
  day,
  showCreditHint,
}: {
  data: ClassCardData;
  day: string;
  showCreditHint: boolean;
}) {
  const state = cupoState(data);
  const badge = BADGE[state];
  const available = Math.max(data.capacity - data.booked, 0);

  return (
    <article className="rounded-2xl border border-border bg-card p-4 shadow-sm transition-base hover:-translate-y-px hover:shadow-md sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        {/* info */}
        <div className="flex items-start gap-4">
          {/* hora destacada (dato de máxima prioridad) + duración */}
          <div className="flex min-w-16 flex-col">
            <span className="text-2xl font-bold leading-none tracking-tight text-foreground">
              {data.time}
            </span>
            {data.durationMin ? (
              <span className="mt-1 text-xs text-muted-foreground">{data.durationMin} min</span>
            ) : null}
          </div>

          {/* nombre + instructor + cupo */}
          <div className="flex-1">
            <h3 className="text-base font-semibold text-foreground">{data.name}</h3>
            {data.instructor ? (
              <p className="mt-0.5 inline-flex items-center gap-1 text-sm text-muted-foreground">
                <User2 className="size-3.5" aria-hidden />
                con {data.instructor}
              </p>
            ) : null}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium text-foreground ${badge.tint}`}
              >
                <span className={`size-1.5 rounded-full ${badge.dot}`} aria-hidden />
                {state === "waiting" && data.waitPosition
                  ? `En espera · puesto ${data.waitPosition}${data.waitingCount > 1 ? ` de ${data.waitingCount}` : ""}`
                  : badge.text}
              </span>
              {state !== "full" && state !== "reserved" && state !== "waiting" ? (
                <span className="text-xs text-muted-foreground">
                  {available} {available === 1 ? "lugar" : "lugares"}
                </span>
              ) : null}
              {/* expectativa honesta: cuántos esperan, antes de anotarse */}
              {state === "full" && data.waitingCount > 0 ? (
                <span className="text-xs text-muted-foreground">
                  {data.waitingCount} {data.waitingCount === 1 ? "espera un lugar" : "esperan un lugar"}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {/* CTA — a opacidad plena siempre (camino a waitlist claro), ancho fijo en desktop */}
        <div className="sm:w-48 sm:shrink-0">
          {state === "reserved" ? (
            <form action={cancelReservation}>
              <input type="hidden" name="res" value={data.myReservationId ?? ""} />
              <input type="hidden" name="day" value={day} />
              <button
                type="submit"
                className="w-full rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
              >
                Cancelar reserva
              </button>
              {data.cancelHint ? (
                <p className="mt-1.5 text-center text-xs text-muted-foreground">{data.cancelHint}</p>
              ) : null}
            </form>
          ) : state === "waiting" ? (
            <form action={leaveWaitlist}>
              <input type="hidden" name="occ" value={data.occurrenceId} />
              <input type="hidden" name="day" value={day} />
              <button
                type="submit"
                className="w-full rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
              >
                Salir de la lista
              </button>
              <p className="mt-1.5 text-center text-xs text-muted-foreground">
                Si se libera un lugar, tu reserva se confirma sola y la ves acá.
              </p>
            </form>
          ) : state === "full" ? (
            <form action={joinWaitlist}>
              <input type="hidden" name="occ" value={data.occurrenceId} />
              <input type="hidden" name="day" value={day} />
              <button
                type="submit"
                className="w-full rounded-lg border border-primary px-4 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/5"
              >
                Lista de espera
              </button>
            </form>
          ) : (
            <form action={reserve}>
              <input type="hidden" name="occ" value={data.occurrenceId} />
              <input type="hidden" name="day" value={day} />
              <button
                type="submit"
                className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:opacity-90"
              >
                Reservar
              </button>
              {showCreditHint ? (
                <p className="mt-1.5 text-center text-xs text-muted-foreground">
                  Usás 1 clase de tu pack.
                </p>
              ) : null}
            </form>
          )}
        </div>
      </div>
    </article>
  );
}
