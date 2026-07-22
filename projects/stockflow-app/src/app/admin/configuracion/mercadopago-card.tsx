"use client";

import { useState, useTransition } from "react";
import { Check, LoaderCircle, TriangleAlert, QrCode, Copy, ExternalLink } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  conectarMercadoPago,
  guardarFirmaWebhook,
  desconectarMercadoPago,
  type EstadoMp,
} from "./mercadopago-actions";

/**
 * Conexión de la cuenta de MercadoPago del negocio.
 *
 * El texto insiste en una cosa porque es la que genera desconfianza: la plata va
 * DIRECTO a su cuenta. SYNTRA no intermedia fondos ni cobra comisión por transacción.
 */
export function MercadoPagoCard({ estado }: { estado: EstadoMp }) {
  const [token, setToken] = useState("");
  const [firma, setFirma] = useState("");
  const [aviso, setAviso] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [pending, startTransition] = useTransition();

  function correr(fn: () => Promise<{ ok: true; mensaje: string } | { ok: false; error: string }>) {
    startTransition(async () => {
      const r = await fn();
      setAviso(r.ok ? { tone: "ok", text: r.mensaje } : { tone: "error", text: r.error });
      if (r.ok) {
        setToken("");
        setFirma("");
      }
    });
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-start gap-2.5">
        <QrCode className="mt-0.5 size-5 shrink-0 text-primary-ink" />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-medium">Cobrar con QR</h2>
          <p className="text-sm text-muted-foreground">
            El cliente escanea desde la caja y el sistema marca la venta como cobrada solo. La
            plata va directo a tu cuenta de MercadoPago — no pasa por nosotros.
          </p>
        </div>
      </div>

      {aviso && (
        <p
          role="status"
          className={cn(
            "mb-3 flex items-start gap-2 rounded-lg px-3 py-2 text-sm ring-1",
            aviso.tone === "ok"
              ? "bg-success/10 text-success-ink ring-success/25"
              : "bg-danger/10 text-danger-ink ring-danger/25",
          )}
        >
          {aviso.tone === "ok" ? (
            <Check className="mt-0.5 size-4 shrink-0" />
          ) : (
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          )}
          {aviso.text}
        </p>
      )}

      {!estado.cifradoListo && (
        <p className="mb-3 rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning-ink ring-1 ring-warning/25">
          Falta configurar el servidor (MP_ENC_KEY). Hasta que esté, no guardamos credenciales:
          preferimos no aceptar tu token antes que guardarlo sin cifrar.
        </p>
      )}

      {estado.conectado ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2.5">
            <span className="size-2 shrink-0 rounded-full bg-success" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                Conectado{estado.nickname ? ` como ${estado.nickname}` : ""}
              </p>
              <p className="text-xs text-muted-foreground">
                {estado.cajaLista
                  ? "Caja creada en tu MercadoPago. Ya podés cobrar con QR."
                  : "Falta la caja en MercadoPago — volvé a conectar para crearla."}
              </p>
            </div>
          </div>

          {/* Firma del webhook: opcional, pero es lo que impide que un tercero nos
              avise "te pagaron" cuando nadie pagó. */}
          <details className="rounded-lg border border-border">
            <summary className="cursor-pointer list-none px-3 py-2.5 text-sm">
              <span className="font-medium">Avisos de MercadoPago</span>
              <span className="ml-2 text-xs text-muted-foreground">
                {estado.tieneFirma ? "· firma configurada" : "· recomendado"}
              </span>
            </summary>
            <div className="space-y-2 border-t border-border p-3">
              <p className="text-xs text-muted-foreground">
                En tu panel de MercadoPago → Tus integraciones → Webhooks, pegá esta dirección y
                copiá acá la clave secreta que te dan.
              </p>
              {estado.urlWebhook ? (
                <div className="flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded-md bg-background px-2 py-1.5 text-xs">
                    {estado.urlWebhook}
                  </code>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(estado.urlWebhook!);
                      setCopiado(true);
                    }}
                    aria-label="Copiar dirección"
                    className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-md border border-border text-muted-foreground hover:text-foreground"
                  >
                    {copiado ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  </button>
                </div>
              ) : (
                <p className="text-xs text-warning-ink">
                  Falta NEXT_PUBLIC_APP_URL en el servidor para armar la dirección.
                </p>
              )}
              <input
                value={firma}
                onChange={(e) => setFirma(e.target.value)}
                placeholder="Clave secreta del webhook"
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary"
              />
              <button
                type="button"
                disabled={pending || firma.trim().length < 8}
                onClick={() => correr(() => guardarFirmaWebhook({ secret: firma }))}
                className="h-9 cursor-pointer rounded-lg border border-border px-3 text-sm font-medium transition-colors hover:border-primary disabled:opacity-40"
              >
                Guardar clave
              </button>
            </div>
          </details>

          <button
            type="button"
            disabled={pending}
            onClick={() => correr(desconectarMercadoPago)}
            className="cursor-pointer text-sm text-danger-ink transition-opacity hover:opacity-80 disabled:opacity-40"
          >
            Desconectar la cuenta
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <label htmlFor="mp-token" className="text-sm font-medium">
            Tu Access Token de MercadoPago
          </label>
          <input
            id="mp-token"
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="APP_USR-…"
            autoComplete="off"
            disabled={!estado.cifradoListo}
            className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary disabled:opacity-40"
          />
          <p className="text-xs text-muted-foreground">
            Lo sacás de tu panel de MercadoPago, en Tus integraciones → tu aplicación →
            Credenciales de producción. Lo guardamos cifrado y no vuelve a mostrarse.
          </p>
          <a
            href="https://www.mercadopago.com.ar/developers/panel/app"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary-ink hover:underline"
          >
            Abrir el panel de MercadoPago <ExternalLink className="size-3" />
          </a>
          <button
            type="button"
            disabled={pending || token.trim().length < 20 || !estado.cifradoListo}
            onClick={() => correr(() => conectarMercadoPago({ accessToken: token }))}
            className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {pending && <LoaderCircle className="size-4 animate-spin" />}
            Conectar mi cuenta
          </button>
        </div>
      )}
    </section>
  );
}
