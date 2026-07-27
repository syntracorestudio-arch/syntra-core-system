"use client";

import { useEffect, useRef, useState } from "react";
import { X, LoaderCircle, Check, TriangleAlert, QrCode, Smartphone } from "lucide-react";
import { money } from "@/lib/format";
import { crearCobroPoint, estadoCobro, cancelarCobro } from "@/app/pos/cobro-qr-actions";

type Item = { product_id: string | null; qty: number };

type Fase =
  | { f: "enviando" }
  | { f: "esperando"; intentId: string }
  | { f: "pagado"; intentId: string }
  | { f: "error"; mensaje: string; sinCuenta: boolean; sinTerminal: boolean };

/**
 * Cobro con la terminal Point (Cobros Fase 2).
 *
 * Gemelo del `CobroQrDialog`: mismo esqueleto (pedir → esperar → pagado/error) y el
 * MISMO polling a MercadoPago (`estadoCobro`), porque la orden Point se lee igual que
 * la del QR. La diferencia es el empujón: en vez de mostrar un QR, MP manda el monto a
 * la pantalla de la terminal física y el cajero pasa la tarjeta ahí.
 *
 * Siempre hay DOS salidas por si la terminal se traba: "Cobrar con QR en pantalla"
 * (el fallback que pidió el owner: un toque y sigue cobrando) y "ya me pagó — cobrar
 * igual" (registrar la venta a mano si el pago se confirmó por otro lado).
 */
export function CobroPointDialog({
  items,
  amount,
  idempotencyKey,
  descripcion,
  onPagado,
  onFallbackQr,
  onCerrar,
}: {
  items: Item[];
  amount: number;
  idempotencyKey: string;
  descripcion: string;
  /** `intentId` null = el cajero cobró sin confirmación de MercadoPago. */
  onPagado: (intentId: string | null) => void;
  /** Salida a QR en pantalla si la terminal falla (el padre regenera la clave). */
  onFallbackQr: () => void;
  onCerrar: () => void;
}) {
  const [fase, setFase] = useState<Fase>({ f: "enviando" });
  const pedido = useRef(false);
  const procesado = useRef(false);
  const pagoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (pagoTimer.current) clearTimeout(pagoTimer.current);
  }, []);

  const onPagadoRef = useRef(onPagado);
  useEffect(() => {
    onPagadoRef.current = onPagado;
  }, [onPagado]);

  // Empujar el monto a la terminal una sola vez (React monta el efecto dos veces en dev).
  useEffect(() => {
    if (pedido.current) return;
    pedido.current = true;

    crearCobroPoint({ items, amount, idempotency_key: idempotencyKey, descripcion })
      .then((res) => {
        if (!res.ok) {
          setFase({
            f: "error",
            mensaje: res.error,
            sinCuenta: Boolean(res.sinCuenta),
            sinTerminal: Boolean(res.sinTerminal),
          });
          return;
        }
        setFase({ f: "esperando", intentId: res.intentId });
      })
      .catch(() =>
        setFase({ f: "error", mensaje: "No pudimos enviar el cobro a la terminal.", sinCuenta: false, sinTerminal: false }),
      );
  }, [items, amount, idempotencyKey, descripcion]);

  // Consultar el estado mientras el cliente paga en la terminal (mismo poll que el QR).
  const intentId = fase.f === "esperando" ? fase.intentId : null;
  useEffect(() => {
    if (!intentId) return;
    let vivo = true;

    const timer = setInterval(async () => {
      const r = await estadoCobro(intentId);
      if (!vivo) return;
      if (r.estado === "pagado") {
        if (procesado.current) return;
        procesado.current = true;
        setFase({ f: "pagado", intentId });
        // El mismo patrón del QR: NO se guarda con `vivo`. Ver la nota larga en
        // CobroQrDialog — `procesado` garantiza un único `onPagado`.
        pagoTimer.current = setTimeout(() => onPagadoRef.current(intentId), 900);
      } else if (r.estado === "vencido") {
        setFase({ f: "error", mensaje: "El cobro venció en la terminal. Probá de nuevo.", sinCuenta: false, sinTerminal: false });
      }
    }, 2500);

    return () => {
      vivo = false;
      clearInterval(timer);
    };
  }, [intentId]);

  function cerrar() {
    if (fase.f === "esperando") void cancelarCobro(fase.intentId);
    onCerrar();
  }

  function fallback() {
    // Liberar la terminal antes de irnos al QR (best-effort: si ya está en el
    // aparato, MP rechaza el cancel y hay que cortar desde ahí).
    if (fase.f === "esperando") void cancelarCobro(fase.intentId);
    onFallbackQr();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/75 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-popover p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Cobrar con QR en el posnet</p>
            <p className="text-2xl font-semibold tabular">{money(amount)}</p>
          </div>
          <button
            type="button"
            onClick={cerrar}
            aria-label="Cerrar"
            className="cursor-pointer text-muted-foreground hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>

        {fase.f === "enviando" && (
          <div className="grid h-64 place-items-center rounded-xl border border-border">
            <div className="text-center">
              <LoaderCircle className="mx-auto mb-2 size-6 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Generando el QR en el posnet…</p>
            </div>
          </div>
        )}

        {fase.f === "esperando" && (
          <div className="grid h-64 place-items-center rounded-xl border border-border bg-background">
            <div className="text-center">
              <QrCode className="mx-auto mb-3 size-12 text-primary-ink" />
              <p className="text-base font-medium">El QR está en el posnet</p>
              <p className="mt-1 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Smartphone className="size-4" />
                Que lo escanee con su celular
              </p>
              <p className="mt-2 flex items-center justify-center gap-2 text-sm">
                <span className="size-2 animate-pulse rounded-full bg-primary" />
                Esperando el pago…
              </p>
            </div>
          </div>
        )}

        {fase.f === "pagado" && (
          <div className="grid h-64 place-items-center rounded-xl bg-success/10 ring-1 ring-success/25">
            <div className="text-center">
              <Check className="mx-auto mb-2 size-10 text-success-ink" />
              <p className="text-lg font-semibold text-success-ink">Pagado</p>
            </div>
          </div>
        )}

        {fase.f === "error" && (
          <div className="rounded-xl bg-danger/10 p-4 ring-1 ring-danger/25">
            <TriangleAlert className="mb-2 size-5 text-danger-ink" />
            <p className="break-words text-sm text-danger-ink">{fase.mensaje}</p>
            {fase.sinTerminal && (
              <p className="mt-2 text-xs text-muted-foreground">
                Configurá tu terminal en Ajustes → Cobrar con la terminal. Mientras tanto, cobrá
                con el QR en pantalla.
              </p>
            )}
            {fase.sinCuenta && (
              <p className="mt-2 text-xs text-muted-foreground">
                Se conecta una sola vez desde Ajustes → Cobrar con QR.
              </p>
            )}
          </div>
        )}

        <div className="mt-4 space-y-2">
          {/* Fallback estrella: si la terminal se traba, un toque y seguís con el QR. */}
          {fase.f !== "pagado" && (
            <button
              type="button"
              onClick={fallback}
              className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              <QrCode className="size-4" />
              Cobrar con QR en pantalla
            </button>
          )}

          {/* Salida manual: registrar la venta si el pago se confirmó por fuera. */}
          {fase.f === "esperando" && (
            <button
              type="button"
              onClick={() => onPagado(fase.intentId)}
              className="h-11 w-full cursor-pointer rounded-lg border border-border text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
            >
              Ya me pagó — cobrar igual
            </button>
          )}

          <button
            type="button"
            onClick={cerrar}
            className="h-9 w-full cursor-pointer text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Cancelar la venta
          </button>
        </div>
      </div>
    </div>
  );
}
