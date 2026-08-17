"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Mail } from "lucide-react";
import { pedirRecuperacion, type RecuperarState } from "./actions";

function Boton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity duration-150 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <Mail className="size-4" aria-hidden />
      {pending ? "Enviando…" : "Mandame el link"}
    </button>
  );
}

export function RecuperarForm() {
  const [state, action] = useActionState<RecuperarState, FormData>(pedirRecuperacion, {});

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="email" className="text-sm font-medium">
          Tu email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="vos@tunegocio.com"
          aria-describedby={state.error || state.aviso ? "recuperar-msg" : undefined}
          className="h-11 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
        />
      </div>

      {/* `aviso` no es un error: es el empleado, que no tiene email y necesita
          otra instrucción. Distinto tono, distinto color — decirle "error" a
          alguien que hizo lo correcto lo manda a reintentar en vano. */}
      {(state.error || state.aviso) && (
        <p
          id="recuperar-msg"
          aria-live="polite"
          className={
            state.error
              ? "rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger-ink"
              : "rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-muted-foreground"
          }
        >
          {state.error ?? state.aviso}
        </p>
      )}

      <Boton />
    </form>
  );
}
