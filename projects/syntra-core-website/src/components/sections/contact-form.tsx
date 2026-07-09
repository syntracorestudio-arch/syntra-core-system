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
import { HONEYPOT_FIELD } from "@/lib/validations/lead";
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

      <motion.div variants={formGroup} className="grid gap-5 sm:grid-cols-2">
        <Field
          id={fieldId("name")}
          name="name"
          label="Nombre"
          icon={User}
          placeholder="Tu nombre"
          autoComplete="name"
          error={state.errors?.name}
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
        />
      </motion.div>

      {/* Tipo de proyecto (opcional) — orienta antes del mensaje (WEB-013B).
          Checkboxes nativos (MULTI): el server recoge name="projectType" con getAll.
          fieldset/legend ya es el agrupador accesible correcto para checkboxes.
          Materialidad mínima/on-system; la elevación visual completa es WEB-013C. */}
      <motion.fieldset variants={formGroup}>
        <legend className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
          <LayoutGrid className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          Tipo de proyecto{" "}
          <span className="font-normal text-muted-foreground">(opcional)</span>
        </legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {projectTypeOptions.map((opt) => (
            <label
              key={opt.value}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border bg-surface-1 px-4 py-2 text-sm text-muted-foreground transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-accent-primary/50 hover:bg-surface-2 hover:text-foreground hover:shadow-[0_6px_18px_-8px_rgba(37,99,235,0.45)] has-[:checked]:border-accent-primary has-[:checked]:bg-accent-primary/15 has-[:checked]:text-foreground has-[:checked]:shadow-[0_0_0_1px_rgba(37,99,235,0.35)] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent-primary/40 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
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

      <motion.div variants={formGroup} className="flex flex-col gap-2">
        <Label htmlFor={fieldId("message")} className="inline-flex items-center gap-2">
          <MessageSquareText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          Contanos qué necesitás
        </Label>
        <Textarea
          id={fieldId("message")}
          name="message"
          maxLength={MESSAGE_MAX}
          placeholder="Describí brevemente tu proyecto, problema u objetivo. Cuanto más claro sea el contexto, mejor vamos a poder orientarte."
          aria-invalid={Boolean(state.errors?.message)}
          aria-describedby={
            state.errors?.message ? `${fieldId("message")}-error` : undefined
          }
          onChange={(e) => setMessageLength(e.currentTarget.value.length)}
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

      <motion.div variants={formGroup} className="flex flex-col sm:flex-row sm:justify-end">
        <Button
          type="submit"
          variant="brand"
          size="xl"
          disabled={isPending}
          className="w-full justify-center sm:w-auto sm:min-w-[12.5rem]"
        >
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
  /** Ícono lucide decorativo, inline antes del label (premium, neutro). */
  icon?: React.ComponentType<{ className?: string }>;
  placeholder?: string;
  type?: string;
  autoComplete?: string;
  error?: string;
}

function Field({ id, name, label, icon: Icon, error, type = "text", ...rest }: FieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} className="inline-flex items-center gap-2">
        {Icon ? <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden /> : null}
        {label}
      </Label>
      <Input
        id={id}
        name={name}
        type={type}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        {...rest}
      />
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
