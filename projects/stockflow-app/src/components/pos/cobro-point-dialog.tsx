"use client";

import { useEffect, useRef, useState } from "react";
import { X, LoaderCircle, Check, TriangleAlert, QrCode, Smartphone, CreditCard, Banknote } from "lucide-react";
import { money } from "@/lib/format";
import { estadoCobro, cancelarCobro, type CobroPoint } from "@/app/pos/cobro-qr-actions";

type PaymentType = "credit_card" | "debit_card";

type Fase =
  | { f: "enviando" }
  | { f: "esperando"; intentId: string }
  | { f: "pagado"; intentId: string }
  | { f: "error"; mensaje: string; sinCuenta: boolean; sinTerminal: boolean };

/**
 * Cobro empujado a la terminal Point. Sirve para las DOS variantes (Fase 2 y 3):
 *
 *   · Sin `paymentType` → la terminal muestra el QR (el cliente escanea en el posnet).
 *   · Con `paymentType` → tarjeta: MP manda el cobro a la terminal ya listo para débito
 *     o crédito; las cuotas y el interés los ofrece la terminal según lo que el dueño
 *     tenga configurado en su cuenta de MercadoPago (nosotros no los tocamos).
 *
 * Gemelo del `CobroQrDialog`: mismo esqueleto (pedir → esperar → pagado/error) y el
 * MISMO polling (`estadoCobro`). Siempre hay salida si la terminal se traba: el
 * `onFallback` (QR en pantalla, o cobro a mano) y "ya me pagó — cobrar igual".
 */
export function CobroPointDialog({
  amount,
  crear,
  paymentType,
  onPagado,
  onFallback,
  fallbackLabel,
  onCerrar,
}: {
  amount: number;
  /** Crea el intento + empuja el cobro a la terminal. El padre decide qué cobra (venta
   *  entera o pata de un split). */
  crear: () => Promise<CobroPoint>;
  /** Sin valor = QR en el posnet. Con valor = tarjeta (débito/crédito). */
  paymentType?: PaymentType;
  /** `intentId` null = el cajero cobró sin confirmación de MercadoPago. */
  onPagado: (intentId: string | null) => void;
  /** Salida si la terminal falla (el padre decide: QR en pantalla o cobro a mano). */
  onFallback: () => void;
  fallbackLabel: string;
  onCerrar: () => void;
}) {
  const [fase, setFase] = useState<Fase>({ f: "enviando" });
  const pedido = useRef(false);
  const procesado = useRef(false);
  const pagoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const esTarjeta = paymentType !== undefined;

  useEffect(() => () => {
    if (pagoTimer.current) clearTimeout(pagoTimer.current);
  }, []);

  const onPagadoRef = useRef(onPagado);
  useEffect(() => {
    onPagadoRef.current = onPagado;
  }, [onPagado]);

  // Empujar el cobro a la terminal una sola vez (React monta el efecto dos veces en dev).
  // El ref desacopla `crear` (flecha inline del padre) del efecto de una sola corrida.
  const crearRef = useRef(crear);
  useEffect(() => {
    crearRef.current = crear;
  }, [crear]);

  useEffect(() => {
    if (pedido.current) return;
    pedido.current = true;

    crearRef
      .current()
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
  }, []);

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
    // Liberar la terminal antes de la salida (best-effort: si ya está en el aparato,
    // MP rechaza el cancel y hay que cortar desde ahí).
    if (fase.f === "esperando") void cancelarCobro(fase.intentId);
    onFallback();
  }

  const titulo = esTarjeta ? "Cobrar con tarjeta en el posnet" : "Cobrar con QR en el posnet";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/75 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-popover p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">{titulo}</p>
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
              <p className="text-sm text-muted-foreground">
                {esTarjeta ? "Enviando el cobro a la terminal…" : "Generando el QR en el posnet…"}
              </p>
            </div>
          </div>
        )}

        {fase.f === "esperando" && (
          <div className="grid h-64 place-items-center rounded-xl border border-border bg-background">
            <div className="text-center">
              {esTarjeta ? (
                <>
                  <CreditCard className="mx-auto mb-3 size-12 text-primary-ink" />
                  <p className="text-base font-medium">Apoyá o pasá la tarjeta en el posnet</p>
                  {paymentType === "credit_card" && (
                    <p className="mt-1 text-sm text-muted-foreground">Las cuotas se eligen en la terminal</p>
                  )}
                </>
              ) : (
                <>
                  <QrCode className="mx-auto mb-3 size-12 text-primary-ink" />
                  <p className="text-base font-medium">El QR está en el posnet</p>
                  <p className="mt-1 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Smartphone className="size-4" />
                    Que lo escanee con su celular
                  </p>
                </>
              )}
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
                Configurá tu terminal en Ajustes → Cobrar con la terminal.
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
          {/* Fallback: si la terminal se traba, un toque y seguís cobrando. */}
          {fase.f !== "pagado" && (
            <button
              type="button"
              onClick={fallback}
              className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              {esTarjeta ? <Banknote className="size-4" /> : <QrCode className="size-4" />}
              {fallbackLabel}
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
