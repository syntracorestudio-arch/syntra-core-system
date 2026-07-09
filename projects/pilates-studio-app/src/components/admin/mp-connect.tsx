"use client";

import { useFormStatus } from "react-dom";
import { CheckCircle2, Link2, Unlink, ShieldCheck, ShieldAlert } from "lucide-react";
import {
  connectMercadoPago,
  disconnectMercadoPago,
  setWebhookSecret,
} from "@/app/admin/configuracion/mp-actions";
import { buttonClass } from "@/components/ui/button";

function ConnectButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass("primary", "md", "w-full sm:w-auto")}>
      <Link2 className="size-4" aria-hidden />
      {pending ? "Conectando…" : "Conectar"}
    </button>
  );
}

function SecretSubmit({ hasSecret }: { hasSecret: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary disabled:opacity-60"
    >
      {pending ? "Guardando…" : hasSecret ? "Actualizar clave" : "Guardar clave"}
    </button>
  );
}

/** Bloque de firma del webhook (defensa extra): URL a configurar en MP + clave secreta. */
function WebhookSignature({ hasSecret, webhookUrl }: { hasSecret: boolean; webhookUrl: string | null }) {
  return (
    <div className="mt-4 border-t border-border pt-4">
      <p className="flex items-center gap-2 text-sm font-medium text-foreground">
        {hasSecret ? (
          <ShieldCheck className="size-4 text-success" aria-hidden />
        ) : (
          <ShieldAlert className="size-4 text-warning" aria-hidden />
        )}
        Firma del webhook {hasSecret ? "activa" : "(opcional, recomendada)"}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Para máxima seguridad, en tu panel de MercadoPago → <em>Webhooks</em>, configurá esta URL de notificación y
        pegá acá la <strong>clave secreta</strong> que MP te da. Así validamos que cada aviso viene de MP.
      </p>
      {webhookUrl ? (
        <code className="mt-2 block overflow-x-auto whitespace-nowrap rounded-lg bg-surface-sunken px-3 py-2 text-xs text-muted-foreground">
          {webhookUrl}
        </code>
      ) : (
        <p className="mt-2 text-xs text-warning">
          Falta configurar la URL pública del webhook (MP_WEBHOOK_URL) en el entorno del deploy.
        </p>
      )}
      <form action={setWebhookSecret} className="mt-3 flex flex-wrap items-end gap-2">
        <label className="grid gap-1 text-xs">
          <span className="text-muted-foreground">Clave secreta {hasSecret ? "(dejá vacío para quitarla)" : ""}</span>
          <input
            type="password"
            name="webhook_secret"
            autoComplete="off"
            placeholder={hasSecret ? "•••••••• (configurada)" : "Pegá tu clave secreta de MP"}
            className="w-64 max-w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none transition-base placeholder:text-muted-foreground/60 focus:border-transparent focus:ring-2 focus:ring-ring"
          />
        </label>
        <SecretSubmit hasSecret={hasSecret} />
      </form>
    </div>
  );
}

export function MpConnect({
  connected,
  nickname,
  hasSecret,
  webhookUrl,
}: {
  connected: boolean;
  nickname: string | null;
  hasSecret: boolean;
  webhookUrl: string | null;
}) {
  if (connected) {
    return (
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="inline-flex items-center gap-2 text-sm text-foreground">
            <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-0.5 text-xs font-medium text-success">
              <CheckCircle2 className="size-3.5" aria-hidden />
              Conectado
            </span>
            {nickname ? <span className="text-muted-foreground">como {nickname}</span> : null}
          </p>
          <form action={disconnectMercadoPago}>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
            >
              <Unlink className="size-3.5" aria-hidden />
              Desconectar
            </button>
          </form>
        </div>
        <WebhookSignature hasSecret={hasSecret} webhookUrl={webhookUrl} />
      </div>
    );
  }

  return (
    <form action={connectMercadoPago} className="grid gap-3">
      <label className="grid gap-1.5 text-sm">
        <span className="font-medium text-foreground">Access Token de MercadoPago</span>
        <input
          type="password"
          name="access_token"
          autoComplete="off"
          placeholder="APP_USR-… (o TEST-… en pruebas)"
          className="rounded-xl border border-input bg-card px-3 py-2.5 text-foreground outline-none transition-base placeholder:text-muted-foreground/60 focus:border-transparent focus:ring-2 focus:ring-ring"
        />
      </label>
      <label className="grid gap-1.5 text-sm">
        <span className="font-medium text-foreground">
          Clave secreta del webhook <span className="text-muted-foreground">(opcional)</span>
        </span>
        <input
          type="password"
          name="webhook_secret"
          autoComplete="off"
          placeholder="La configurás luego si preferís"
          className="rounded-xl border border-input bg-card px-3 py-2.5 text-foreground outline-none transition-base placeholder:text-muted-foreground/60 focus:border-transparent focus:ring-2 focus:ring-ring"
        />
      </label>
      <p className="text-xs text-muted-foreground">
        El Access Token lo generás en tu panel de MercadoPago. Se guarda <strong>cifrado</strong> y solo del lado del
        servidor — nunca se expone. El dinero entra directo a tu cuenta.
      </p>
      <ConnectButton />
    </form>
  );
}
