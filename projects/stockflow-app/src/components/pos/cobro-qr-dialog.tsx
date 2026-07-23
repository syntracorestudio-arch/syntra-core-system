"use client";

import { useEffect, useRef, useState } from "react";
import { X, LoaderCircle, Check, TriangleAlert, Smartphone } from "lucide-react";
import { cn } from "@/lib/cn";
import { money } from "@/lib/format";
import { crearCobroQR, estadoCobro, cancelarCobro } from "@/app/pos/cobro-qr-actions";

type Item = { product_id: string | null; qty: number };

type Fase =
  | { f: "pidiendo" }
  | { f: "esperando"; intentId: string; svg: string }
  | { f: "pagado"; intentId: string }
  | { f: "error"; mensaje: string; sinCuenta: boolean };

/**
 * Cobro con QR en el mostrador.
 *
 * La caja pregunta el estado a MercadoPago cada 2,5 s en vez de esperar un webhook:
 * el kiosquero necesita saber que le pagaron AHORA, con el cliente todavía enfrente.
 *
 * Siempre hay salida manual ("ya me pagó"): un cobro que se cuelga no puede dejar
 * al cajero atrapado con la fila esperando. La venta se registra igual y el cobro
 * queda registrado como no confirmado — honesto, y el dueño lo ve en Caja.
 */
export function CobroQrDialog({
  items,
  amount,
  idempotencyKey,
  descripcion,
  onPagado,
  onCerrar,
}: {
  items: Item[];
  amount: number;
  idempotencyKey: string;
  descripcion: string;
  /** `intentId` null = el cajero cobró sin confirmación de MercadoPago. */
  onPagado: (intentId: string | null) => void;
  onCerrar: () => void;
}) {
  const [fase, setFase] = useState<Fase>({ f: "pidiendo" });
  const pedido = useRef(false);

  /* `onPagado` es una flecha inline del POS: cambia de identidad en cada render
     del padre. Si el efecto de abajo dependiera de ella, cada render reiniciaría
     el intervalo y el cobro podría no detectarse nunca. El ref lo desacopla. */
  const onPagadoRef = useRef(onPagado);
  useEffect(() => {
    onPagadoRef.current = onPagado;
  }, [onPagado]);

  // Pedir el QR una sola vez, aunque React monte el efecto dos veces en dev.
  useEffect(() => {
    if (pedido.current) return;
    pedido.current = true;

    crearCobroQR({ items, amount, idempotency_key: idempotencyKey, descripcion })
      .then((res) => {
        if (!res.ok) {
          setFase({ f: "error", mensaje: res.error, sinCuenta: Boolean(res.sinCuenta) });
          return;
        }
        setFase({ f: "esperando", intentId: res.intentId, svg: res.qrSvg });
      })
      .catch(() => setFase({ f: "error", mensaje: "No pudimos generar el QR.", sinCuenta: false }));
  }, [items, amount, idempotencyKey, descripcion]);

  // Consultar el estado mientras el cliente escanea.
  const intentId = fase.f === "esperando" ? fase.intentId : null;
  useEffect(() => {
    if (!intentId) return;
    let vivo = true;

    const timer = setInterval(async () => {
      const r = await estadoCobro(intentId);
      if (!vivo) return;
      if (r.estado === "pagado") {
        setFase({ f: "pagado", intentId });
        // Un respiro para que el cajero VEA el tilde antes de que se cierre.
        setTimeout(() => vivo && onPagadoRef.current(intentId), 900);
      } else if (r.estado === "vencido") {
        setFase({ f: "error", mensaje: "El código venció. Generá uno nuevo.", sinCuenta: false });
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

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/75 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-popover p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Cobrar con QR</p>
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

        {fase.f === "pidiendo" && (
          <div className="grid h-64 place-items-center rounded-xl border border-border">
            <div className="text-center">
              <LoaderCircle className="mx-auto mb-2 size-6 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Pidiendo el código…</p>
            </div>
          </div>
        )}

        {fase.f === "esperando" && (
          <>
            {/* Fondo blanco sí o sí: un QR invertido no lo lee la mitad de los
                teléfonos, y este se escanea desde una pantalla de mostrador. */}
            <div
              className="mx-auto w-full max-w-64 rounded-xl bg-white p-3 [&>svg]:h-auto [&>svg]:w-full"
              dangerouslySetInnerHTML={{ __html: fase.svg }}
            />
            <p className="mt-3 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Smartphone className="size-4" />
              Que lo escanee con su app
            </p>
            <p className="mt-1 flex items-center justify-center gap-2 text-sm">
              <span className="size-2 animate-pulse rounded-full bg-primary" />
              Esperando el pago…
            </p>
          </>
        )}

        {fase.f === "pagado" && (
          <div className="grid h-64 place-items-center rounded-xl bg-success/10 ring-1 ring-success/25">
            <div className="text-center">
              <Check className="mx-auto mb-2 size-10 text-success-ink" />
              <p className="text-lg font-semibold text-success-ink">Te pagó</p>
            </div>
          </div>
        )}

        {fase.f === "error" && (
          <div className="rounded-xl bg-danger/10 p-4 ring-1 ring-danger/25">
            <TriangleAlert className="mb-2 size-5 text-danger-ink" />
            <p className="text-sm text-danger-ink">{fase.mensaje}</p>
            {fase.sinCuenta && (
              <p className="mt-2 text-xs text-muted-foreground">
                Se conecta una sola vez desde Ajustes → Cobrar con QR. Mientras tanto, cobrá con
                el QR de siempre y marcá la venta como QR.
              </p>
            )}
          </div>
        )}

        <div className="mt-4 space-y-2">
          {/* La salida manual existe SIEMPRE que haya un cliente esperando. */}
          {fase.f !== "pagado" && (
            <button
              type="button"
              onClick={() => onPagado(null)}
              className={cn(
                "h-11 w-full cursor-pointer rounded-lg text-sm font-semibold transition-colors",
                fase.f === "error"
                  ? "bg-primary text-primary-foreground hover:opacity-90"
                  : "border border-border text-foreground hover:bg-secondary",
              )}
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
