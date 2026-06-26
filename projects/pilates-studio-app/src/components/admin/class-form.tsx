"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { CalendarDays, Repeat, Minus, Plus } from "lucide-react";
import { createClass, updateClass } from "@/app/admin/clases/actions";

export type ClassFormInitial = {
  classId: string;
  name: string;
  instructor: string;
  capacity: number;
  duration: number;
  kind: "once" | "recurring";
  date: string; // única (YYYY-MM-DD)
  time: string; // HH:MM
  weekdays: number[]; // recurrente
  validFrom: string;
  validTo: string;
};

const DAYS: { wd: number; label: string }[] = [
  { wd: 1, label: "L" },
  { wd: 2, label: "M" },
  { wd: 3, label: "M" },
  { wd: 4, label: "J" },
  { wd: 5, label: "V" },
  { wd: 6, label: "S" },
  { wd: 0, label: "D" },
];

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function SubmitButton({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:opacity-90 disabled:opacity-60"
    >
      {pending ? "Guardando…" : editing ? "Guardar cambios" : "Crear clase"}
    </button>
  );
}

export function ClassForm({ initial = null }: { initial?: ClassFormInitial | null }) {
  const editing = initial !== null;
  const [type, setType] = useState<"once" | "recurring">(initial?.kind ?? "once");
  const [days, setDays] = useState<number[]>(initial?.weekdays ?? []);
  const [capacity, setCapacity] = useState(initial?.capacity ?? 8);

  const toggleDay = (wd: number) =>
    setDays((d) => (d.includes(wd) ? d.filter((x) => x !== wd) : [...d, wd]));

  return (
    <form action={editing ? updateClass : createClass} className="grid gap-4">
      <input type="hidden" name="type" value={type} />
      {editing ? <input type="hidden" name="classId" value={initial!.classId} /> : null}

      {/* toggle Única / Recurrente (bloqueado en edición: no se cambia el tipo) */}
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-secondary p-1">
        {(["once", "recurring"] as const).map((t) => {
          const active = type === t;
          const Icon = t === "once" ? CalendarDays : Repeat;
          const locked = editing && !active;
          return (
            <button
              key={t}
              type="button"
              onClick={() => !editing && setType(t)}
              disabled={locked}
              aria-disabled={locked}
              className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              } ${locked ? "cursor-not-allowed opacity-40" : ""}`}
            >
              <Icon className="size-4" aria-hidden />
              {t === "once" ? "Única" : "Recurrente"}
            </button>
          );
        })}
      </div>

      <Field label="Nombre">
        <input name="name" required maxLength={80} defaultValue={initial?.name ?? ""} className={inputCls} />
      </Field>
      <Field label="Instructor">
        <input name="instructor" maxLength={80} defaultValue={initial?.instructor ?? ""} className={inputCls} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5 text-sm">
          <span className="font-medium text-foreground">Cupo</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Menos"
              onClick={() => setCapacity((n) => Math.max(1, n - 1))}
              className="flex size-11 items-center justify-center rounded-md border border-input text-foreground hover:bg-secondary"
            >
              <Minus className="size-4" aria-hidden />
            </button>
            <input
              name="capacity"
              type="number"
              min={1}
              max={200}
              value={capacity}
              onChange={(e) => setCapacity(Math.max(1, Number(e.target.value) || 1))}
              className="w-14 rounded-md border border-input bg-card px-2 py-2 text-center text-foreground outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="button"
              aria-label="Más"
              onClick={() => setCapacity((n) => Math.min(200, n + 1))}
              className="flex size-11 items-center justify-center rounded-md border border-input text-foreground hover:bg-secondary"
            >
              <Plus className="size-4" aria-hidden />
            </button>
          </div>
        </div>
        <Field label="Duración (min)">
          <input
            name="duration"
            type="number"
            min={10}
            max={240}
            defaultValue={initial?.duration ?? 60}
            className={inputCls}
          />
        </Field>
      </div>

      {type === "once" ? (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Fecha">
            <input
              name="date"
              type="date"
              required
              defaultValue={initial?.date || todayStr()}
              className={inputCls}
            />
          </Field>
          <Field label="Hora">
            <input name="time" type="time" required defaultValue={initial?.time || "18:00"} className={inputCls} />
          </Field>
        </div>
      ) : (
        <>
          <div className="grid gap-1.5 text-sm">
            <span className="font-medium text-foreground">Días</span>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((d, i) => {
                const active = days.includes(d.wd);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleDay(d.wd)}
                    aria-pressed={active}
                    className={`flex size-11 items-center justify-center rounded-full border text-sm transition-colors ${
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-foreground hover:bg-secondary"
                    }`}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
            {days.map((wd) => (
              <input key={wd} type="hidden" name="days" value={wd} />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Hora">
              <input name="time" type="time" required defaultValue={initial?.time || "18:00"} className={inputCls} />
            </Field>
            <Field label="Desde">
              <input
                name="valid_from"
                type="date"
                required
                defaultValue={initial?.validFrom || todayStr()}
                className={inputCls}
              />
            </Field>
          </div>
          <Field label="Hasta (opcional)">
            <input name="valid_to" type="date" defaultValue={initial?.validTo || ""} className={inputCls} />
          </Field>
          <p className="text-xs text-muted-foreground">
            {editing
              ? "Se regeneran las clases futuras sin reservas. Las que ya tienen alumnos anotados no se modifican."
              : "Se crea una clase cada semana en los días elegidos, por las próximas 8 semanas."}
          </p>
        </>
      )}

      <div className="mt-1 flex gap-2">
        <SubmitButton editing={editing} />
        {editing ? (
          <a
            href="/admin/clases"
            className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
          >
            Cancelar
          </a>
        ) : null}
      </div>
    </form>
  );
}

const inputCls =
  "rounded-md border border-input bg-card px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-ring";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="font-medium text-foreground">{label}</span>
      {children}
    </label>
  );
}
