"use client";

import * as React from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import {
  AlertCircle,
  Building2,
  Check,
  CheckCircle2,
  LayoutGrid,
  Mail,
  MessageSquareText,
  Send,
  User,
} from "lucide-react";

import { contactSuccess, projectTypeOptions, siteConfig } from "@/config/site";
import { EASE_PREMIUM, DURATION, VIEWPORT_ONCE } from "@/lib/motion";
import { track } from "@/lib/analytics";
// lead-shared (no lead.ts): evita arrastrar zod al bundle cliente de la Home.
import { HONEYPOT_FIELD } from "@/lib/validations/lead-shared";
import { submitLead } from "@/app/actions/submit-lead";
import { initialLeadState } from "@/app/actions/lead-form-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/** Reveal escalonado de los grupos del form (premium, sutil). Solo opacity/transform
 *  → CLS 0. reduced-motion safe: las variantes se neutralizan más abajo. */
const formStagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
};

const formGroup: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATION.standard, ease: EASE_PREMIUM },
  },
};

/** Materia "vidrio hundido" de la atmósfera para inputs/textarea (pase Aterrizaje
 *  térmico): fill oscuro translúcido familia #05070c + hairline interior + bloom
 *  electric al focus. Solo borde/sombra/color → CLS 0. */
const GLASS_FIELD =
  "rounded-xl border-white/[0.08] bg-[#070b14]/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),inset_0_2px_10px_rgba(0,0,0,0.35)] backdrop-blur-sm placeholder:text-foreground/30 hover:border-white/[0.16] focus-visible:border-[#60a5fa]/60 focus-visible:bg-[#070b14]/80 focus-visible:ring-[#60a5fa]/25 focus-visible:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_26px_-6px_rgba(96,165,250,0.5)]";

/**
 * ContactForm — captura de leads.
 * useActionState (React 19): valida en servidor, muestra errores por campo,
 * estado de carga y confirmación. Accesible + tracking de eventos.
 */
function ContactForm() {
  const { finalCta } = siteConfig.sections;
  const reduceMotion = useReducedMotion();

  const [state, formAction, isPending] = React.useActionState(
    submitLead,
    initialLeadState,
  );

  const baseId = React.useId();
  const fieldId = (name: string) => `${baseId}-${name}`;

  // Largo del mensaje SOLO para el contador condicional (no controla el value):
  // el textarea sigue siendo no-controlado, solo leemos el length en cada input.
  const MESSAGE_MAX = 1000;
  const [messageLength, setMessageLength] = React.useState(0);

  // Tipo de proyecto (opcional): MULTI-select. Checkboxes CONTROLADOS, todos con
  // name="projectType" → el server los recoge con getAll. [] = ninguno → no viaja.
  // Regla de exclusividad: "unsure" ("Todavía no lo tengo claro") no convive con otros.
  const [projectTypes, setProjectTypes] = React.useState<string[]>([]);

  // form_start: una sola vez por montaje, al primer focus de cualquier campo.
  const formStarted = React.useRef(false);
  const handleFirstFocus = () => {
    if (!formStarted.current) {
      formStarted.current = true;
      track("form_start");
    }
  };

  // Tracking de resultado (nuevo objeto state por envío).
  React.useEffect(() => {
    if (state.status === "success") track("lead_submitted");
    else if (state.status === "error") {
      // reason genérico, sin PII (validation = errores de campo; server = el resto).
      track("lead_submit_error", { reason: state.errors ? "validation" : "server" });
    }
  }, [state]);

  // Tras un error de validación, llevar el foco al PRIMER campo inválido (puede
  // quedar fuera de viewport). Solo al volver la action (state nuevo), no por render.
  React.useEffect(() => {
    if (state.status !== "error" || !state.errors) return;
    for (const key of ["name", "email", "company", "message"] as const) {
      if (state.errors[key]) {
        document.getElementById(`${baseId}-${key}`)?.focus();
        break;
      }
    }
  }, [state, baseId]);

  if (state.status === "success") {
    return (
      <div
        role="status"
        className="success-reveal relative overflow-hidden rounded-2xl border border-accent-warm/30 bg-accent-warm/[0.05] px-6 py-12 text-center"
      >
        {/* Hairline de cierre (warm dorado = HECHO; sobrio, sin glow) */}
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent-warm/50 to-transparent"
        />
        <span className="success-check mx-auto mb-5 inline-flex size-14 items-center justify-center rounded-full border border-accent-warm/40 bg-accent-warm/10 text-accent-warm">
          <CheckCircle2 className="size-7" aria-hidden="true" />
        </span>
        <p className="font-heading text-xl font-semibold tracking-tight sm:text-2xl">
          {contactSuccess.title}
        </p>
        <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
          {contactSuccess.body}
        </p>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-foreground/80">
          {contactSuccess.microcopy}
        </p>
        <p className="mt-8 inline-flex items-center gap-1.5 rounded-full border border-accent-warm/30 bg-surface-2 px-3 py-1 text-xs font-medium text-accent-warm">
          <Check className="size-3 shrink-0" aria-hidden="true" />
          {contactSuccess.secondary}
        </p>
      </div>
    );
  }

  // reduced-motion safe: arranca en "visible" y no anima.
  const initial = reduceMotion ? "visible" : "hidden";

  return (
    <motion.form
      action={formAction}
      onSubmit={() => track("lead_submit_attempt")}
      onFocus={handleFirstFocus}
      noValidate
      className="flex flex-col gap-5 text-left"
      variants={formStagger}
      initial={initial}
      whileInView="visible"
      viewport={VIEWPORT_ONCE}
    >
      {/* Honeypot anti-spam (oculto a usuarios, accesible a bots) */}
      <div aria-hidden="true" className="absolute -left-[9999px]" >
        <label htmlFor={fieldId(HONEYPOT_FIELD)}>No completar</label>
        <input
          id={fieldId(HONEYPOT_FIELD)}
          name={HONEYPOT_FIELD}
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      {/* Nombre+Email en dos columnas solo cuando la columna del form da el
          ancho. En lg el form vive en la mitad angosta del panel de Contacto:
          ahí van apilados (dos campos de ~190px con ícono adentro dejan ~150px
          útiles y un email real no entra). Desde xl vuelven a la fila. */}
      <motion.div
        variants={formGroup}
        className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2"
      >
        <Field
          id={fieldId("name")}
          name="name"
          label="Nombre"
          icon={User}
          placeholder="Tu nombre"
          autoComplete="name"
          error={state.errors?.name}
          defaultValue={state.values?.name}
        />
        <Field
          id={fieldId("email")}
          name="email"
          type="email"
          label="Email"
          icon={Mail}
          placeholder="tu@email.com"
          autoComplete="email"
          error={state.errors?.email}
          defaultValue={state.values?.email}
        />
      </motion.div>

      <motion.div variants={formGroup}>
        <Field
          id={fieldId("company")}
          name="company"
          label="Empresa (opcional)"
          icon={Building2}
          placeholder="Nombre de tu empresa"
          autoComplete="organization"
          error={state.errors?.company}
          defaultValue={state.values?.company}
        />
      </motion.div>

      {/* Tipo de proyecto (opcional) — orienta antes del mensaje (WEB-013B).
          Checkboxes nativos (MULTI): el server recoge name="projectType" con getAll.
          fieldset/legend ya es el agrupador accesible correcto para checkboxes.
          Materialidad mínima/on-system; la elevación visual completa es WEB-013C. */}
      <motion.fieldset variants={formGroup}>
        <legend className="inline-flex flex-wrap items-center gap-2 text-[0.7rem] font-medium tracking-[0.14em] uppercase text-foreground/60">
          <LayoutGrid
            className="size-4 shrink-0 text-[#60a5fa] [filter:drop-shadow(0_0_6px_rgba(96,165,250,0.45))]"
            aria-hidden
          />
          Tipo de proyecto{" "}
          <span className="font-normal normal-case tracking-normal text-muted-foreground">
            (opcional · podés marcar más de una)
          </span>
        </legend>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {projectTypeOptions.map((opt) => (
            <label
              key={opt.value}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-white/10 bg-[#070b14]/60 px-4 py-2 text-sm text-foreground/65 max-lg:py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-accent-primary/50 hover:text-foreground hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_6px_18px_-8px_rgba(37,99,235,0.45)] has-[:checked]:border-accent-primary has-[:checked]:bg-accent-primary/15 has-[:checked]:text-foreground has-[:checked]:shadow-[0_0_0_1px_rgba(37,99,235,0.35),0_6px_20px_-8px_rgba(37,99,235,0.5)] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent-primary/40 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            >
              <input
                type="checkbox"
                name="projectType"
                value={opt.value}
                checked={projectTypes.includes(opt.value)}
                onChange={() =>
                  setProjectTypes((prev) => {
                    const has = prev.includes(opt.value);
                    // "unsure" es excluyente: marcar → solo él; desmarcar → vacío.
                    if (opt.value === "unsure") return has ? [] : ["unsure"];
                    // Cualquier otro: toggle + limpia "unsure" si estaba.
                    return has
                      ? prev.filter((v) => v !== opt.value)
                      : [...prev.filter((v) => v !== "unsure"), opt.value];
                  })
                }
                className="peer sr-only"
              />
              {/* Check visible solo cuando el chip está seleccionado; entra con un
                  toque de escala (transform/opacity → CLS 0, reduced-motion safe).
                  Azul brillante + glow para que se note. */}
              <Check
                aria-hidden="true"
                strokeWidth={3}
                className="size-4 w-0 shrink-0 scale-0 text-[#5b9bff] opacity-0 transition-all duration-200 ease-out [filter:drop-shadow(0_0_4px_rgba(91,155,255,0.7))] peer-checked:w-4 peer-checked:scale-100 peer-checked:opacity-100 motion-reduce:transition-none"
              />
              {opt.label}
            </label>
          ))}
        </div>
      </motion.fieldset>

      <motion.div variants={formGroup} className="group flex flex-col gap-2">
        <Label
          htmlFor={fieldId("message")}
          className="inline-flex items-center gap-2 text-[0.7rem] font-medium tracking-[0.14em] uppercase text-foreground/60 transition-colors group-focus-within:text-foreground/90"
        >
          <MessageSquareText
            className="size-4 shrink-0 text-[#60a5fa] [filter:drop-shadow(0_0_6px_rgba(96,165,250,0.45))] transition-colors group-focus-within:text-[#93c5fd]"
            aria-hidden
          />
          Contanos qué necesitás
        </Label>
        <Textarea
          id={fieldId("message")}
          name="message"
          maxLength={MESSAGE_MAX}
          placeholder="Contanos tu proyecto, problema u objetivo — con tus palabras alcanza."
          aria-invalid={Boolean(state.errors?.message)}
          aria-describedby={
            state.errors?.message ? `${fieldId("message")}-error` : undefined
          }
          onChange={(e) => setMessageLength(e.currentTarget.value.length)}
          defaultValue={state.values?.message}
          className={GLASS_FIELD}
        />
        <div className="flex items-start justify-between gap-3">
          {/* Helper de conversión (content-driven): baja la barrera de entrada */}
          <p className="text-xs text-muted-foreground">{finalCta.messageHelper}</p>
          {/* Contador condicional: aparece solo cerca del límite (no "0/1000" fijo) */}
          {messageLength > 800 ? (
            <p className="shrink-0 text-xs tabular-nums text-muted-foreground/70">
              {messageLength}/{MESSAGE_MAX}
            </p>
          ) : null}
        </div>
        {state.errors?.message ? (
          <p
            id={`${fieldId("message")}-error`}
            className="flex items-center gap-1.5 text-sm text-destructive"
          >
            <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
            {state.errors.message}
          </p>
        ) : null}
      </motion.div>

      {state.status === "error" && state.message ? (
        <p
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
        >
          <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
          {state.message}
        </p>
      ) : null}

      <motion.div variants={formGroup} className="flex flex-col gap-2.5 sm:items-end">
        <Button
          type="submit"
          variant="brand"
          size="xl"
          disabled={isPending}
          className="group relative w-full justify-center overflow-hidden bg-gradient-to-b from-[#3b82f6] to-[#1d4ed8] shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_14px_34px_-12px_rgba(37,99,235,0.7)] transition-shadow duration-300 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_18px_44px_-12px_rgba(37,99,235,0.9)] sm:w-auto sm:min-w-[12.5rem]"
        >
          {/* Sheen de hover (transform-only, reduced-motion lo oculta) */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -translate-x-full bg-[linear-gradient(105deg,transparent,rgba(255,255,255,0.22),transparent)] transition-transform duration-700 ease-out group-hover:translate-x-full motion-reduce:hidden"
          />
          {isPending ? "Enviando..." : "Enviar consulta"}
          {/* Ícono siempre presente: reserva su espacio para que el ancho no salte
              entre estados (CLS 0 en interacción). Se atenúa al enviar. */}
          <Send data-icon="inline-end" aria-hidden="true" className={isPending ? "opacity-0" : undefined} />
        </Button>
      </motion.div>

    </motion.form>
  );
}

interface FieldProps {
  id: string;
  name: string;
  label: string;
  /** Ícono lucide DENTRO del input (izquierda; muted → electric al focus). */
  icon?: React.ComponentType<{ className?: string }>;
  placeholder?: string;
  type?: string;
  autoComplete?: string;
  error?: string;
  /** Eco del valor tipeado tras un error (React 19 resetea el form al volver la action). */
  defaultValue?: string;
}

function Field({ id, name, label, icon: Icon, error, type = "text", ...rest }: FieldProps) {
  return (
    <div className="group flex flex-col gap-2">
      <Label
        htmlFor={id}
        className="text-[0.7rem] font-medium tracking-[0.14em] uppercase text-foreground/60 transition-colors group-focus-within:text-foreground/90"
      >
        {label}
      </Label>
      <div className="relative">
        {Icon ? (
          <Icon
            className="pointer-events-none absolute top-1/2 left-3.5 z-10 size-4 -translate-y-1/2 text-[#60a5fa] [filter:drop-shadow(0_0_6px_rgba(96,165,250,0.45))] transition-colors group-focus-within:text-[#93c5fd]"
            aria-hidden
          />
        ) : null}
        <Input
          id={id}
          name={name}
          type={type}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`${GLASS_FIELD} ${Icon ? "pl-10" : ""}`}
          {...rest}
        />
      </div>
      {error ? (
        <p
          id={`${id}-error`}
          className="flex items-center gap-1.5 text-sm text-destructive"
        >
          <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : null}
    </div>
  );
}

export { ContactForm };
