"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { buttonClass } from "@/components/ui/button";
import { updateSettings } from "@/app/admin/configuracion/actions";

export type SettingsInitial = {
  name: string;
  accent: string;
  timezone: string;
  cancellationWindowHours: number;
  reservationPolicy: string;
  graceN: number;
  refundOnLateCancel: boolean;
  defaultCapacity: number;
  waitlistEnabled: boolean;
  expiryWarningDays: number;
};

const TIMEZONES = [
  "America/Argentina/Buenos_Aires",
  "America/Montevideo",
  "America/Santiago",
  "America/Sao_Paulo",
  "America/Mexico_City",
  "Europe/Madrid",
];

const POLICIES: { v: string; label: string }[] = [
  { v: "require_credit_or_membership", label: "Requiere crédito o abono" },
  { v: "allow_with_warning", label: "Permite con aviso" },
  { v: "allow_grace_n", label: "Permite N reservas fiadas" },
  { v: "block_if_debt", label: "Bloquea si tiene deuda" },
];

const inputCls =
  "rounded-md border border-input bg-card px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-ring";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass("primary", "md", "w-full sm:w-auto")}>
      {pending ? "Guardando…" : "Guardar cambios"}
    </button>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="font-medium text-foreground">{label}</span>
      {children}
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

function Toggle({ name, defaultChecked, label, hint }: { name: string; defaultChecked: boolean; label: string; hint?: string }) {
  return (
    <label className="flex items-start gap-3 text-sm">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-0.5 size-4 accent-[var(--primary)]" />
      <span>
        <span className="font-medium text-foreground">{label}</span>
        {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
      </span>
    </label>
  );
}

export function SettingsForm({ initial }: { initial: SettingsInitial }) {
  const [accent, setAccent] = useState(initial.accent);
  const [policy, setPolicy] = useState(initial.reservationPolicy);

  return (
    <form action={updateSettings} className="grid gap-6">
      {/* Identidad + marca */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-base font-semibold text-foreground">Identidad</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Nombre del estudio">
            <input name="name" required maxLength={80} defaultValue={initial.name} className={inputCls} />
          </Field>
          <Field label="Color de acento" hint="Tu marca tiñe botones, foco y destacados de la app.">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={accent}
                onChange={(e) => setAccent(e.target.value)}
                aria-label="Elegir color"
                className="size-10 shrink-0 cursor-pointer rounded-md border border-input bg-card"
              />
              <input
                name="accent"
                value={accent}
                onChange={(e) => setAccent(e.target.value)}
                pattern="#[0-9a-fA-F]{6}"
                className={`${inputCls} w-32 font-mono uppercase`}
              />
              <span
                className="ml-1 inline-flex items-center gap-1.5 rounded-md px-2.5 py-2 text-xs font-semibold text-white"
                style={{ backgroundColor: accent }}
              >
                Vista previa
              </span>
            </div>
          </Field>
          <Field label="Zona horaria">
            <select name="timezone" defaultValue={initial.timezone} className={inputCls}>
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </section>

      {/* Reservas y cancelación */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-base font-semibold text-foreground">Reservas y cancelación</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Política de reserva">
            <select
              name="reservation_policy"
              value={policy}
              onChange={(e) => setPolicy(e.target.value)}
              className={inputCls}
            >
              {POLICIES.map((p) => (
                <option key={p.v} value={p.v}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>
          {policy === "allow_grace_n" ? (
            <Field label="Reservas fiadas (N)">
              <input
                name="grace_n"
                type="number"
                min={0}
                max={20}
                defaultValue={initial.graceN}
                className={inputCls}
              />
            </Field>
          ) : (
            <input type="hidden" name="grace_n" value={initial.graceN} />
          )}
          <Field label="Ventana de cancelación (horas)" hint="Hasta cuántas horas antes se puede cancelar con devolución.">
            <input
              name="cancellation_window_hours"
              type="number"
              min={0}
              max={336}
              defaultValue={initial.cancellationWindowHours}
              className={inputCls}
            />
          </Field>
          <Field label="Cupo por defecto">
            <input
              name="default_capacity"
              type="number"
              min={1}
              max={200}
              defaultValue={initial.defaultCapacity}
              className={inputCls}
            />
          </Field>
          <Field label="Avisar vencimiento (días antes)">
            <input
              name="expiry_warning_days"
              type="number"
              min={0}
              max={90}
              defaultValue={initial.expiryWarningDays}
              className={inputCls}
            />
          </Field>
        </div>
        <div className="mt-4 grid gap-3">
          <Toggle
            name="refund_on_late_cancel"
            defaultChecked={initial.refundOnLateCancel}
            label="Devolver crédito en cancelaciones tardías"
            hint="Si está apagado, cancelar fuera de la ventana no devuelve el crédito."
          />
          <Toggle
            name="waitlist_enabled"
            defaultChecked={initial.waitlistEnabled}
            label="Habilitar lista de espera"
            hint="Los alumnos pueden anotarse cuando una clase está llena."
          />
        </div>
      </section>

      <div className="flex justify-end">
        <SaveButton />
      </div>
    </form>
  );
}
