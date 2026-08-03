"use client";

/**
 * date-pickers.tsx — selectores de período reales (calendario · mes · año), sin
 * dependencias: la app no tiene Radix/popover, así que se apoyan en el mismo patrón
 * bottom-sheet de los diálogos existentes (AnularDialog / NuevoGastoDialog).
 *
 * - DayPicker: calendario mensual, lunes primero, es-AR. Modo "día" (Caja) o
 *   "semana" (Reportes → resalta la semana Lun-Dom del día apuntado).
 * - MonthPicker: grilla de 12 meses + nav de año (Reportes · mes).
 * - YearPicker: años dentro del piso de 24 meses (Reportes · año).
 * - PeriodPicker: despacha el picker correcto según la granularidad de Reportes.
 *
 * Todos trabajan sobre strings YYYY-MM-DD y respetan tope futuro (`today`) y piso
 * (`min`, 24 meses) — ninguna lectura se sale de la cota (scale-security-baseline).
 */

import { useEffect, useState } from "react";
import { Calendar, ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  DIAS_SEMANA,
  MESES_CORTOS,
  addMonths,
  dayOf,
  endOfMonth,
  formatMonthYear,
  monthOf,
  startOfMonth,
  startOfWeekMonday,
  yearOf,
} from "@/lib/date";

// ── Chrome compartido ──────────────────────────────────────────────────────────

function Trigger({
  label,
  onClick,
  className,
}: {
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-11 cursor-pointer items-center gap-2 rounded-lg border border-border bg-background/60 px-3 text-sm font-medium text-foreground transition-colors hover:border-primary/50",
        className,
      )}
    >
      <Calendar className="size-4 shrink-0 text-muted-foreground" />
      <span className="tabular flex-1 truncate text-left">{label}</span>
      <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-end bg-black/60 sm:place-items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[85dvh] w-full overflow-y-auto rounded-t-2xl border border-border bg-popover p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:max-w-xs sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="cursor-pointer text-muted-foreground hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Flechas de navegación (mes o año) reutilizadas por los tres pickers. */
function NavHeader({
  label,
  onPrev,
  onNext,
  prevDisabled,
  nextDisabled,
}: {
  label: string;
  onPrev: () => void;
  onNext: () => void;
  prevDisabled: boolean;
  nextDisabled: boolean;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <button
        type="button"
        onClick={onPrev}
        disabled={prevDisabled}
        aria-label="Anterior"
        className="grid size-9 cursor-pointer place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
      >
        <ChevronLeft className="size-4" />
      </button>
      <span className="text-sm font-medium">{label}</span>
      <button
        type="button"
        onClick={onNext}
        disabled={nextDisabled}
        aria-label="Siguiente"
        className="grid size-9 cursor-pointer place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}

// ── DayPicker (calendario) ───────────────────────────────────────────────────

export function DayPicker({
  value,
  today,
  min,
  onSelect,
  label,
  weekMode = false,
  triggerClassName,
}: {
  value: string;
  today: string;
  min: string;
  onSelect: (ymd: string) => void;
  label: string;
  weekMode?: boolean;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => startOfMonth(value));

  function abrir() {
    setView(startOfMonth(value)); // arrancar siempre en el mes del valor vigente
    setOpen(true);
  }

  const first = startOfMonth(view);
  const leading = (new Date(`${first}T12:00:00Z`).getUTCDay() + 6) % 7; // Mon=0
  const totalDias = dayOf(endOfMonth(view));
  const semanaSel = weekMode ? startOfWeekMonday(value) : null;

  function pick(ymd: string) {
    setOpen(false);
    onSelect(ymd);
  }

  return (
    <>
      <Trigger label={label} onClick={abrir} className={triggerClassName} />
      {open && (
        <Sheet title={weekMode ? "Elegí una semana" : "Elegí un día"} onClose={() => setOpen(false)}>
          <NavHeader
            label={formatMonthYear(view)}
            onPrev={() => setView(addMonths(view, -1))}
            onNext={() => setView(addMonths(view, 1))}
            prevDisabled={first <= startOfMonth(min)}
            nextDisabled={first >= startOfMonth(today)}
          />
          <div className="grid grid-cols-7 gap-1">
            {DIAS_SEMANA.map((d) => (
              <div key={d} className="grid h-8 place-items-center text-xs font-medium text-muted-foreground">
                {d}
              </div>
            ))}
            {Array.from({ length: leading }, (_, i) => (
              <div key={`b${i}`} />
            ))}
            {Array.from({ length: totalDias }, (_, i) => {
              const dia = String(i + 1).padStart(2, "0");
              const ymd = `${view.slice(0, 7)}-${dia}`;
              const disabled = ymd > today || ymd < min;
              const seleccionado = weekMode
                ? startOfWeekMonday(ymd) === semanaSel
                : ymd === value;
              return (
                <button
                  key={ymd}
                  type="button"
                  disabled={disabled}
                  onClick={() => pick(ymd)}
                  className={cn(
                    "tabular grid h-10 cursor-pointer place-items-center rounded-md text-sm transition-colors",
                    seleccionado
                      ? "bg-primary font-semibold text-primary-foreground"
                      : "hover:bg-secondary",
                    disabled && "cursor-not-allowed text-muted-foreground/30 hover:bg-transparent",
                  )}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
        </Sheet>
      )}
    </>
  );
}

// ── MonthPicker ──────────────────────────────────────────────────────────────

export function MonthPicker({
  value,
  today,
  min,
  onSelect,
  label,
  triggerClassName,
}: {
  value: string;
  today: string;
  min: string;
  onSelect: (ymd: string) => void;
  label: string;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(() => yearOf(value));

  function abrir() {
    setYear(yearOf(value)); // arrancar en el año del valor vigente
    setOpen(true);
  }

  const topeMes = startOfMonth(today);
  const pisoMes = startOfMonth(min);

  function pick(ymd: string) {
    setOpen(false);
    onSelect(ymd);
  }

  return (
    <>
      <Trigger label={label} onClick={abrir} className={triggerClassName} />
      {open && (
        <Sheet title="Elegí un mes" onClose={() => setOpen(false)}>
          <NavHeader
            label={String(year)}
            onPrev={() => setYear((y) => y - 1)}
            onNext={() => setYear((y) => y + 1)}
            prevDisabled={year <= yearOf(min)}
            nextDisabled={year >= yearOf(today)}
          />
          <div className="grid grid-cols-3 gap-1.5">
            {MESES_CORTOS.map((m, i) => {
              const ymd = `${year}-${String(i + 1).padStart(2, "0")}-01`;
              const disabled = ymd > topeMes || ymd < pisoMes;
              const seleccionado = yearOf(value) === year && monthOf(value) === i;
              return (
                <button
                  key={m}
                  type="button"
                  disabled={disabled}
                  onClick={() => pick(ymd)}
                  className={cn(
                    "grid h-11 cursor-pointer place-items-center rounded-md text-sm transition-colors",
                    seleccionado
                      ? "bg-primary font-semibold text-primary-foreground"
                      : "hover:bg-secondary",
                    disabled && "cursor-not-allowed text-muted-foreground/30 hover:bg-transparent",
                  )}
                >
                  {m}
                </button>
              );
            })}
          </div>
        </Sheet>
      )}
    </>
  );
}

// ── YearPicker ───────────────────────────────────────────────────────────────

export function YearPicker({
  value,
  today,
  min,
  onSelect,
  label,
  triggerClassName,
}: {
  value: string;
  today: string;
  min: string;
  onSelect: (ymd: string) => void;
  label: string;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const desde = yearOf(min);
  const hasta = yearOf(today);
  const años = Array.from({ length: hasta - desde + 1 }, (_, i) => hasta - i); // desc

  function pick(y: number) {
    setOpen(false);
    onSelect(`${y}-01-01`);
  }

  return (
    <>
      <Trigger label={label} onClick={() => setOpen(true)} className={triggerClassName} />
      {open && (
        <Sheet title="Elegí un año" onClose={() => setOpen(false)}>
          <div className="grid grid-cols-3 gap-1.5">
            {años.map((y) => {
              const seleccionado = yearOf(value) === y;
              return (
                <button
                  key={y}
                  type="button"
                  onClick={() => pick(y)}
                  className={cn(
                    "tabular grid h-11 cursor-pointer place-items-center rounded-md text-sm transition-colors",
                    seleccionado
                      ? "bg-primary font-semibold text-primary-foreground"
                      : "hover:bg-secondary",
                  )}
                >
                  {y}
                </button>
              );
            })}
          </div>
        </Sheet>
      )}
    </>
  );
}

// ── PeriodPicker (dispatcher de Reportes) ────────────────────────────────────

export function PeriodPicker({
  periodo,
  anchor,
  today,
  min,
  onSelect,
  label,
  triggerClassName,
}: {
  periodo: "semana" | "mes" | "anio";
  anchor: string;
  today: string;
  min: string;
  onSelect: (ymd: string) => void;
  label: string;
  triggerClassName?: string;
}) {
  const common = { value: anchor, today, min, onSelect, label, triggerClassName };
  if (periodo === "semana") return <DayPicker weekMode {...common} />;
  if (periodo === "mes") return <MonthPicker {...common} />;
  return <YearPicker {...common} />;
}
