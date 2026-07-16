"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Check } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { accentForeground } from "@/lib/accent";
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
  waitlistAutoPromote: string;
  expiryWarningDays: number;
  showInstructorPay: boolean;
  // landing pública (branding)
  subtitle: string;
  whatsapp: string;
  address: string;
  instagram: string;
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
    <label className="flex cursor-pointer items-start gap-3 text-sm">
      {/* checkbox custom: pinta el acento EXACTO (accent-color nativo lo sombrea el SO) */}
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="peer sr-only" />
      <span
        aria-hidden
        className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border border-input bg-card transition-base peer-checked:border-primary peer-checked:bg-primary [&>svg]:opacity-0 peer-checked:[&>svg]:opacity-100 peer-focus-visible:ring-2 peer-focus-visible:ring-ring"
      >
        <Check className="size-3 text-primary-foreground" strokeWidth={3} />
      </span>
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

  // Vista previa EN VIVO: pinta toda la app (sidebar incluida) al elegir color.
  // Se aplica sobre #admin-shell (donde el layout inyecta el acento del estudio).
  useEffect(() => {
    const shell = document.getElementById("admin-shell");
    if (!shell || !/^#[0-9a-fA-F]{6}$/.test(accent)) return;
    shell.style.setProperty("--primary", accent);
    shell.style.setProperty("--ring", accent);
    shell.style.setProperty("--primary-foreground", accentForeground(accent));
  }, [accent]);

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
              {/* swatch custom con el hex PURO (el input color nativo lo sombrea el SO) */}
              <span className="relative size-10 shrink-0 overflow-hidden rounded-md border border-input">
                <span className="absolute inset-0" style={{ backgroundColor: accent }} aria-hidden />
                <input
                  type="color"
                  value={accent}
                  onChange={(e) => setAccent(e.target.value)}
                  aria-label="Elegir color"
                  className="absolute inset-0 size-full cursor-pointer opacity-0"
                />
              </span>
              <input
                name="accent"
                value={accent}
                onChange={(e) => setAccent(e.target.value)}
                pattern="#[0-9a-fA-F]{6}"
                className={`${inputCls} w-32 font-mono uppercase`}
              />
              {/* mismo hex en ambos contextos: sobre claro parece un tono, sobre el carbón
                  del menú parece otro — es percepción, no diferencia de color */}
              <span className="ml-1 inline-flex overflow-hidden rounded-lg border border-border text-[11px] font-semibold">
                <span className="inline-flex items-center gap-1 bg-card px-2 py-1.5">
                  <span className="size-3.5 rounded-full" style={{ backgroundColor: accent }} aria-hidden />
                  <span className="text-muted-foreground">panel</span>
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-1.5" style={{ backgroundColor: "#2b2b2f" }}>
                  <span className="size-3.5 rounded-full" style={{ backgroundColor: accent }} aria-hidden />
                  <span style={{ color: "#9d9ba0" }}>menú</span>
                </span>
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
          <Field
            label="Promoción automática de la lista"
            hint="Cuando se libera un lugar, sube solo el primero con saldo y le avisamos. El botón «Subir» del panel queda siempre disponible."
          >
            <select name="waitlist_auto_promote" defaultValue={initial.waitlistAutoPromote} className={inputCls}>
              <option value="until_start">Hasta el inicio de la clase (recomendado)</option>
              <option value="until_window">Hasta la ventana de cancelación</option>
              <option value="manual">Nunca — solo manual desde el panel</option>
            </select>
          </Field>
          <Toggle
            name="show_instructor_pay"
            defaultChecked={initial.showInstructorPay}
            label="Mostrar pago estimado a los instructores"
            hint="Cada instructor ve SU estimado del mes según su tarifa (nunca la de otros)."
          />
        </div>
      </section>

      {/* Landing pública */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-base font-semibold text-foreground">Landing pública</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Datos que se muestran en la página pública de tu estudio (<code>/e/{"{slug}"}</code>).
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Frase / subtítulo" hint='Ej. "Pilates reformer en Palermo · grupos reducidos".'>
            <input name="subtitle" maxLength={120} defaultValue={initial.subtitle} className={inputCls} />
          </Field>
          <Field label="WhatsApp" hint="Número con código de país. Es el CTA principal de la landing.">
            <input name="whatsapp" maxLength={30} defaultValue={initial.whatsapp} placeholder="+54 9 11 …" className={inputCls} />
          </Field>
          <Field label="Dirección">
            <input name="address" maxLength={160} defaultValue={initial.address} className={inputCls} />
          </Field>
          <Field label="Instagram" hint="Usuario o link.">
            <input name="instagram" maxLength={80} defaultValue={initial.instagram} placeholder="@tuestudio" className={inputCls} />
          </Field>
        </div>
      </section>

      <div className="flex justify-end">
        <SaveButton />
      </div>
    </form>
  );
}
