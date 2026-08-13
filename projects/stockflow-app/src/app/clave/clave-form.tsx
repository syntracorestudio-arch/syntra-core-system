"use client";

import { useActionState, useState } from "react";
import { KeyRound, LoaderCircle, TriangleAlert, Lock, Eye, EyeOff } from "lucide-react";
import { cambiarMiClave, type ClaveState } from "./actions";

/** Mismo vocabulario de input que el login (h-11 táctiles, ícono leading). */
export function ClaveForm() {
  const [state, action, pending] = useActionState<ClaveState, FormData>(cambiarMiClave, {});
  const [ver, setVer] = useState(false);

  return (
    <form action={action} className="space-y-4">
      {state.error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger-ink ring-1 ring-danger/25"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          {state.error}
        </p>
      )}

      {[
        { id: "password", label: "Tu contraseña nueva", auto: "new-password" },
        { id: "repetir", label: "Repetila", auto: "new-password" },
      ].map((f) => (
        <div key={f.id} className="space-y-1.5">
          <label htmlFor={f.id} className="text-sm font-medium">
            {f.label}
          </label>
          <div className="relative">
            <Lock
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              id={f.id}
              name={f.id}
              type={ver ? "text" : "password"}
              autoComplete={f.auto}
              required
              minLength={8}
              className="h-11 w-full rounded-xl border border-input bg-card pl-10 pr-11 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-ring"
            />
            {f.id === "password" && (
              <button
                type="button"
                onClick={() => setVer((v) => !v)}
                aria-label={ver ? "Ocultar contraseñas" : "Mostrar contraseñas"}
                className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 cursor-pointer place-items-center rounded-lg text-muted-foreground transition-colors hover:text-foreground"
              >
                {ver ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            )}
          </div>
        </div>
      ))}

      <p className="text-xs text-muted-foreground">
        Al menos 8 caracteres. Elegí una que te acuerdes: no vas a tener que
        cambiarla de nuevo.
      </p>

      <button
        type="submit"
        disabled={pending}
        className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pending ? <LoaderCircle className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
        Guardar y entrar
      </button>
    </form>
  );
}
