"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { cambiarClaveDeCuenta, type CuentaState } from "./actions";

function Boton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-11 w-full cursor-pointer items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity duration-150 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Guardando…" : "Guardar contraseña"}
    </button>
  );
}

export function CuentaForm() {
  const [state, action] = useActionState<CuentaState, FormData>(cambiarClaveDeCuenta, {});
  const [ver, setVer] = useState(false);

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <label htmlFor="password" className="text-sm font-medium">
            Contraseña nueva
          </label>
          <button
            type="button"
            onClick={() => setVer((v) => !v)}
            className="cursor-pointer text-xs text-muted-foreground underline"
          >
            {ver ? "ocultar" : "mostrar"}
          </button>
        </div>
        <input
          id="password"
          name="password"
          type={ver ? "text" : "password"}
          autoComplete="new-password"
          required
          minLength={8}
          className="h-11 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none focus:border-primary"
        />
        <p className="text-xs text-muted-foreground">Al menos 8 caracteres.</p>
      </div>

      {/* El repetir se queda incluso con «mostrar»: acá el usuario está solo, sin
          nadie que le dicte la clave, y un typo lo deja afuera de su propio
          negocio. Es el mismo criterio que el dueño tiene en /clave. */}
      <div className="space-y-1.5">
        <label htmlFor="repetir" className="text-sm font-medium">
          Repetila
        </label>
        <input
          id="repetir"
          name="repetir"
          type={ver ? "text" : "password"}
          autoComplete="new-password"
          required
          className="h-11 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none focus:border-primary"
        />
      </div>

      {state.error && (
        <p
          aria-live="polite"
          className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger-ink"
        >
          {state.error}
        </p>
      )}

      <Boton />
    </form>
  );
}
