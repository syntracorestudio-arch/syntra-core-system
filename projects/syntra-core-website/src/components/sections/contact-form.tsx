"use client";

import * as React from "react";
import { CheckCircle2, Send } from "lucide-react";

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

  // Tracking de resultado (nuevo objeto state por envío).
  React.useEffect(() => {
    if (state.status === "success") track("lead_submitted");
    else if (state.status === "error") track("lead_submit_error");
  }, [state]);

  if (state.status === "success") {
    return (
      <div
        role="status"
        className="flex flex-col items-center gap-3 rounded-2xl border border-brand-electric/20 bg-brand-electric/5 px-6 py-10 text-center"
      >
        <CheckCircle2 className="size-10 text-brand-cyan" aria-hidden="true" />
        <p className="font-heading text-lg font-semibold">Mensaje enviado</p>
        <p className="max-w-sm text-sm text-muted-foreground">{state.message}</p>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      onSubmit={() => track("lead_submit_attempt")}
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

      <div className="flex flex-col gap-2">
        <Label htmlFor={fieldId("message")}>¿Qué necesitás?</Label>
        <Textarea
          id={fieldId("message")}
          name="message"
          placeholder="Contanos brevemente sobre tu proyecto o tu negocio."
          aria-invalid={Boolean(state.errors?.message)}
          aria-describedby={
            state.errors?.message ? `${fieldId("message")}-error` : undefined
          }
        />
        {state.errors?.message ? (
          <p
            id={`${fieldId("message")}-error`}
            className="text-sm text-destructive"
          >
            {state.errors.message}
          </p>
        ) : null}
      </div>

      {state.status === "error" && state.message ? (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      ) : null}

      <Button
        type="submit"
        variant="brand"
        size="xl"
        disabled={isPending}
        className="w-full"
      >
        {isPending ? "Enviando..." : "Enviar mensaje"}
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
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export { ContactForm };
