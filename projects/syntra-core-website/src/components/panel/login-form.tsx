"use client";

import * as React from "react";
import { Lock } from "lucide-react";

import { panelLogin } from "@/app/actions/panel-auth";
import { initialPanelLoginState } from "@/app/actions/panel-auth-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * LoginForm — gate del panel. Isla client mínima (useActionState).
 * La verificación real ocurre 100% en el servidor (panelLogin).
 */
function LoginForm({ from }: { from?: string }) {
  const [state, formAction, isPending] = React.useActionState(
    panelLogin,
    initialPanelLoginState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {from ? <input type="hidden" name="from" value={from} /> : null}
      <div className="flex flex-col gap-2">
        <Label htmlFor="passcode">Passcode de acceso</Label>
        <Input
          id="passcode"
          name="passcode"
          type="password"
          autoComplete="current-password"
          autoFocus
          placeholder="••••••••"
          aria-invalid={Boolean(state.error)}
          aria-describedby={state.error ? "passcode-error" : undefined}
        />
        {state.error ? (
          <p id="passcode-error" role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        ) : null}
      </div>

      <Button
        type="submit"
        variant="brand"
        size="lg"
        disabled={isPending}
        className="w-full"
      >
        <Lock data-icon="inline-start" />
        {isPending ? "Verificando..." : "Ingresar"}
      </Button>
    </form>
  );
}

export { LoginForm };
