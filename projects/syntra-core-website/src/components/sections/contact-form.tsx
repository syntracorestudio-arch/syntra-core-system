"use client";

import * as React from "react";
import { AlertCircle, Check, CheckCircle2, Send } from "lucide-react";

import { contactSuccess, projectTypeOptions } from "@/config/site";
import { track } from "@/lib/analytics";
import { HONEYPOT_FIELD } from "@/lib/validations/lead";
import { submitLead } from "@/app/actions/submit-lead";
import { initialLeadState } from "@/app/actions/lead-form-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * ContactForm — captura de leads.
 * useActionState (React 19): valida en servidor, muestra errores por campo,
 * estado de carga y confirmación. Accesible + tracking de eventos.
 */
function ContactForm() {
  const [state, formAction, isPending] = React.useActionState(
    submitLead,
    initialLeadState,
  );

  const baseId = React.useId();
  const fieldId = (name: string) => `${baseId}-${name}`;

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
        className="success-reveal relative overflow-hidden rounded-2xl border border-brand-cyan/30 bg-brand-cyan/[0.05] px-6 py-12 text-center"
      >
        {/* Hairline de cierre (cyan = HECHO; sobrio, sin glow) */}
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-cyan/50 to-transparent"
        />
        <span className="success-check mx-auto mb-5 inline-flex size-14 items-center justify-center rounded-full border border-brand-cyan/40 bg-brand-cyan/10 text-brand-cyan">
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
        <p className="mt-8 inline-flex items-center gap-1.5 rounded-full border border-brand-cyan/30 bg-surface-2 px-3 py-1 text-xs font-medium text-brand-cyan">
          <Check className="size-3 shrink-0" aria-hidden="true" />
          {contactSuccess.secondary}
        </p>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      onSubmit={() => track("lead_submit_attempt")}
      onFocus={handleFirstFocus}
      noValidate
      className="flex flex-col gap-5 text-left"
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

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          id={fieldId("name")}
          name="name"
          label="Nombre"
          placeholder="Tu nombre"
          autoComplete="name"
          error={state.errors?.name}
        />
        <Field
          id={fieldId("email")}
          name="email"
          type="email"
          label="Email"
          placeholder="tu@email.com"
          autoComplete="email"
          error={state.errors?.email}
        />
      </div>

      <Field
        id={fieldId("company")}
        name="company"
        label="Empresa (opcional)"
        placeholder="Nombre de tu empresa"
        autoComplete="organization"
        error={state.errors?.company}
      />

      {/* Tipo de proyecto (opcional) — orienta antes del mensaje (WEB-013B).
          Radios nativos: envío por FormData + grupo accesible. Materialidad
          mínima/on-system; la elevación visual completa es WEB-013C. */}
      <fieldset>
        <legend className="text-sm font-medium text-foreground">
          Tipo de proyecto{" "}
          <span className="font-normal text-muted-foreground">(opcional)</span>
        </legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {projectTypeOptions.map((opt) => (
            <label
              key={opt.value}
              className="cursor-pointer rounded-full border border-border bg-surface-1 px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground has-[:checked]:border-border-strong has-[:checked]:bg-surface-2 has-[:checked]:text-foreground has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent-primary/40"
            >
              <input
                type="radio"
                name="projectType"
                value={opt.value}
                className="sr-only"
              />
              {opt.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <Label htmlFor={fieldId("message")}>Contanos qué necesitás</Label>
        <Textarea
          id={fieldId("message")}
          name="message"
          placeholder="Describí brevemente tu proyecto, problema u objetivo. Cuanto más claro sea el contexto, mejor vamos a poder orientarte."
          aria-invalid={Boolean(state.errors?.message)}
          aria-describedby={
            state.errors?.message ? `${fieldId("message")}-error` : undefined
          }
        />
        {state.errors?.message ? (
          <p
            id={`${fieldId("message")}-error`}
            className="flex items-center gap-1.5 text-sm text-destructive"
          >
            <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
            {state.errors.message}
          </p>
        ) : null}
      </div>

      {state.status === "error" && state.message ? (
        <p
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
        >
          <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
          {state.message}
        </p>
      ) : null}

      <Button
        type="submit"
        variant="brand"
        size="xl"
        disabled={isPending}
        className="w-full sm:w-auto sm:self-end"
      >
        {isPending ? "Enviando..." : "Enviar consulta"}
        {!isPending && <Send data-icon="inline-end" />}
      </Button>

    </form>
  );
}

interface FieldProps {
  id: string;
  name: string;
  label: string;
  placeholder?: string;
  type?: string;
  autoComplete?: string;
  error?: string;
}

function Field({ id, name, label, error, type = "text", ...rest }: FieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
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
