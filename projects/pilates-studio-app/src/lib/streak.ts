/**
 * Racha de constancia del alumno: semanas SEGUIDAS (lunes a domingo, en la zona
 * horaria del estudio) con al menos una clase asistida. La semana en curso no
 * corta la racha si todavía no fue a clase (se cuenta desde la anterior).
 */

/** Días desde epoch para una fecha local YYYY-MM-DD. */
function epochDays(localDate: string): number {
  const [y, m, d] = localDate.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

/** Índice de semana con inicio LUNES (1970-01-01 fue jueves → +3 alinea el corte). */
function weekIndex(localDate: string): number {
  return Math.floor((epochDays(localDate) + 3) / 7);
}

export function localDateOf(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(iso),
  );
}

/**
 * @param attendedIsos starts_at (ISO) de las clases ASISTIDAS
 * @returns racha actual y récord, en semanas
 */
export function computeStreak(attendedIsos: string[], tz: string, nowIso: string): { current: number; best: number } {
  const weeks = new Set(attendedIsos.map((iso) => weekIndex(localDateOf(iso, tz))));
  if (weeks.size === 0) return { current: 0, best: 0 };

  const thisWeek = weekIndex(localDateOf(nowIso, tz));
  let cursor = weeks.has(thisWeek) ? thisWeek : thisWeek - 1;
  let current = 0;
  while (weeks.has(cursor)) {
    current += 1;
    cursor -= 1;
  }

  const sorted = [...weeks].sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  let prev: number | null = null;
  for (const w of sorted) {
    run = prev !== null && w === prev + 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = w;
  }
  return { current, best: Math.max(best, current) };
}

/**
 * "Tu horario": la franja (clase + día + hora local) que el alumno más repitió.
 * Devuelve null con menos de 3 asistencias en la misma franja (sin datos no hay hábito).
 */
export function habitualSlot(
  rows: { classId: string; className: string; startsAt: string }[],
  tz: string,
): { classId: string; className: string; weekday: number; time: string; count: number } | null {
  const counts = new Map<string, { classId: string; className: string; weekday: number; time: string; count: number }>();
  for (const r of rows) {
    const d = new Date(r.startsAt);
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      })
        .formatToParts(d)
        .map((x) => [x.type, x.value]),
    );
    const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday);
    const time = `${parts.hour}:${parts.minute}`;
    const key = `${r.classId}|${weekday}|${time}`;
    const cur = counts.get(key);
    if (cur) cur.count += 1;
    else counts.set(key, { classId: r.classId, className: r.className, weekday, time, count: 1 });
  }
  let bestSlot: { classId: string; className: string; weekday: number; time: string; count: number } | null = null;
  for (const v of counts.values()) {
    if (!bestSlot || v.count > bestSlot.count) bestSlot = v;
  }
  return bestSlot && bestSlot.count >= 3 ? bestSlot : null;
}

export const WEEKDAY_LABEL = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

/**
 * Clases asistidas por semana (lunes-domingo, tz del estudio) para las últimas
 * `weeks` semanas, ordenadas de la más vieja a la actual (la actual es la última).
 */
export function weeklyCounts(attendedIsos: string[], tz: string, nowIso: string, weeks = 12): number[] {
  const thisWeek = weekIndex(localDateOf(nowIso, tz));
  const counts = new Array<number>(weeks).fill(0);
  for (const iso of attendedIsos) {
    const w = weekIndex(localDateOf(iso, tz));
    const slot = weeks - 1 - (thisWeek - w);
    if (slot >= 0 && slot < weeks) counts[slot] += 1;
  }
  return counts;
}
