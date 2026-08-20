"use client";

import { useActionState, useState } from "react";
import { LogIn, LoaderCircle, TriangleAlert, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { entrarAlPanel, type EstadoAcceso } from "./actions";

/**
 * El formulario del panel de plataforma.
 *
 * Sin "me olvidé la contraseña" a propósito: ese camino manda un mail, y acá el
 * único que puede recuperar el acceso es el que tiene la `service_role` — o sea
 * `npm run superadmin:crear`, que ya es idempotente justo para esto. Ofrecer un
 * link que no puede resolver nada sería peor que no ofrecerlo.
 */
export function PanelForm({ clave }: { clave: string }) {
  const [verClave, setVerClave] = useState(false);
  const [state, action, pending] = useActionState<EstadoAcceso, FormData>(
    entrarAlPanel.bind(null, clave),
    {},
  );

  return (
    <form action={action} className="space-y-4">
      {state.error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger-ink ring-1 ring-danger/25"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {state.error}
        </p>
      )}

      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
          Email
        </label>
        <div className="relative">
          <Mail
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="username"
            autoFocus
            className="h-11 w-full rounded-lg border border-input bg-card pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
          />
        </div>
      </div>

      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-medium">
          Contraseña
        </label>
        <div className="relative">
          <Lock
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            id="password"
            name="password"
            type={verClave ? "text" : "password"}
            required
            autoComplete="current-password"
            placeholder="••••••••"
            className="h-11 w-full rounded-lg border border-input bg-card pl-9 pr-11 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
          />
          <button
            type="button"
            onClick={() => setVerClave((v) => !v)}
            aria-label={verClave ? "Ocultar contraseña" : "Mostrar contraseña"}
            className="absolute right-1 top-1/2 grid size-9 -translate-y-1/2 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
          >
            {verClave ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? (
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
        ) : (
          <LogIn className="size-4" aria-hidden />
        )}
        Entrar
      </button>
    </form>
  );
}
