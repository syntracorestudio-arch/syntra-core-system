"use client";

import { useFormStatus } from "react-dom";
import { CheckCircle2, Link2, Unlink } from "lucide-react";
import { connectMercadoPago, disconnectMercadoPago } from "@/app/admin/configuracion/mp-actions";
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

export function MpConnect({ connected, nickname }: { connected: boolean; nickname: string | null }) {
  if (connected) {
    return (
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
      <p className="text-xs text-muted-foreground">
        Lo generás en tu panel de MercadoPago. Se guarda <strong>cifrado</strong> y solo del lado del servidor — nunca
        se expone. El dinero entra directo a tu cuenta.
      </p>
      <ConnectButton />
    </form>
  );
}
