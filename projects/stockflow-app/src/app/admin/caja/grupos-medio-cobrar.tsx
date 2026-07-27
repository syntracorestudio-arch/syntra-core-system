"use client";

import { useState, useTransition } from "react";
import { TriangleAlert, CreditCard, QrCode, X, LoaderCircle } from "lucide-react";
import { money } from "@/lib/format";
import { crearCobroSplit, crearCobroSplitPoint } from "@/app/pos/cobro-qr-actions";
import { registerSplitGroup } from "@/app/pos/actions";
import { reembolsarGrupo } from "./actions";
import { CobroQrDialog } from "@/components/pos/cobro-qr-dialog";
import { CobroPointDialog } from "@/components/pos/cobro-point-dialog";

type Parte = { method: string; amount: number };

export type GrupoMedioCobrar = {
  group_id: string;
  items: { product_id: string | null; qty: number }[];
  split_pagos: Parte[];
  total: number;
  client_id: string | null;
  cuando: string;
  vencido: boolean;
  cobrado: Parte[];
  pendiente: Parte[];
};

const NOMBRE: Record<string, string> = { card: "tarjeta", qr: "QR", cash: "efectivo", transfer: "transferencia" };

/**
 * Ventas "a medio cobrar": un split de dos electrónicas donde una pata acreditó y la
 * otra no (la caja se cayó entre las dos). La plata de la primera ya entró, pero la venta
 * no existe. Acá el dueño ve qué se cobró y qué falta, y **cobra lo que falta**: reabre el
 * cobro de la pata pendiente con el MISMO grupo → al acreditar, la venta se registra
 * (`register_split_group`, que verifica que las dos patas estén cobradas). El reembolso de
 * la pata ya cobrada (cuando el cliente se fue) llega en el Paso 3.
 */
type Fase = "elegir" | "card-ask" | "card-terminal" | "qr-ask" | "qr-pantalla" | "qr-terminal";
type Resumen = {
  grupo: GrupoMedioCobrar;
  metodo: "card" | "qr";
  monto: number;
  fase: Fase;
  paymentType?: "credit_card" | "debit_card";
};

export function GruposMedioCobrar({
  grupos,
  posnetActivo,
  reembolsoHabilitado,
}: {
  grupos: GrupoMedioCobrar[];
  posnetActivo: boolean;
  reembolsoHabilitado: boolean;
}) {
  const [resueltos, setResueltos] = useState<Set<string>>(new Set());
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [confirmReembolso, setConfirmReembolso] = useState<string | null>(null);
  const [procesando, setProcesando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const visibles = grupos.filter((g) => !resueltos.has(g.group_id));
  if (visibles.length === 0) return null;

  const items = (g: GrupoMedioCobrar) => g.items.map((i) => ({ product_id: i.product_id, qty: i.qty }));
  const claveLeg = (g: GrupoMedioCobrar, m: "card" | "qr") => `${g.group_id}-${m === "card" ? "C" : "Q"}`;

  /** Arranca el resumen de la pata pendiente: elige el canal según el método. */
  function empezar(g: GrupoMedioCobrar) {
    setError(null);
    const pend = g.pendiente[0];
    if (!pend || (pend.method !== "card" && pend.method !== "qr")) {
      setError("No pudimos determinar qué falta cobrar.");
      return;
    }
    const metodo = pend.method as "card" | "qr";
    if (metodo === "card") {
      if (!posnetActivo) {
        setError("Falta cobrar una parte con tarjeta y no hay terminal configurada. Reembolsá la otra parte (próximamente) o configurá el posnet.");
        return;
      }
      setResumen({ grupo: g, metodo, monto: pend.amount, fase: "card-ask" });
    } else {
      setResumen({ grupo: g, metodo, monto: pend.amount, fase: posnetActivo ? "qr-ask" : "qr-pantalla" });
    }
  }

  /** La pata pendiente acreditó → registra la venta verificando el grupo completo. */
  function cerrar(g: GrupoMedioCobrar) {
    startTransition(async () => {
      const res = await registerSplitGroup({
        group_id: g.group_id,
        items: items(g),
        pagos: g.split_pagos,
        idempotency_key: `${g.group_id}-S`,
      });
      setResumen(null);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setResueltos((s) => new Set(s).add(g.group_id));
    });
  }

  /** Reembolsa y anula: devuelve por MP lo cobrado y deja el grupo sin venta. */
  function reembolsar(g: GrupoMedioCobrar) {
    setError(null);
    setProcesando(g.group_id);
    startTransition(async () => {
      const res = await reembolsarGrupo(g.group_id);
      setProcesando(null);
      setConfirmReembolso(null);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setResueltos((s) => new Set(s).add(g.group_id));
    });
  }

  return (
    <section className="mb-4 rounded-xl bg-warning/10 p-4 ring-1 ring-warning/25">
      <div className="mb-2 flex items-start gap-2">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning-ink" />
        <div>
          <h2 className="text-sm font-medium text-warning-ink">
            {visibles.length === 1
              ? "Una venta quedó a medio cobrar"
              : `${visibles.length} ventas quedaron a medio cobrar`}
          </h2>
          <p className="text-sm text-muted-foreground">
            Se cobró una parte y falta la otra. Cobrá lo que falta para cerrar la venta.
          </p>
        </div>
      </div>

      {error && <p className="mb-2 text-sm text-danger-ink">{error}</p>}

      <ul className="space-y-1.5">
        {visibles.map((g) => {
          const cobrado = g.cobrado
            .map((c) => `${money(Number(c.amount))} con ${NOMBRE[c.method] ?? c.method}`)
            .join(" + ");
          const falta = g.pendiente
            .map((p) => `${money(Number(p.amount))} en ${NOMBRE[p.method] ?? p.method}`)
            .join(" + ");
          return (
            <li
              key={g.group_id}
              className={
                "flex items-center gap-3 rounded-lg border bg-card px-3 py-2 " +
                (g.vencido ? "border-danger/40 ring-1 ring-danger/20" : "border-border")
              }
            >
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-sm">
                  <span className="font-medium tabular">{money(Number(g.total))}</span>
                  {g.vencido && (
                    <span className="rounded-full bg-danger/15 px-2 py-0.5 text-xs font-semibold text-danger-ink">
                      Revisar
                    </span>
                  )}
                  <span className="text-muted-foreground">· cobraste {cobrado}, falta {falta}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(g.cuando).toLocaleString("es-AR", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  })}{" "}
                  · {g.items.reduce((a, i) => a + i.qty, 0)} unidades
                </p>
              </div>
              {confirmReembolso === g.group_id ? (
                <div className="flex shrink-0 items-center gap-2">
                  <span className="hidden text-xs text-muted-foreground sm:inline">
                    ¿Devolver {cobrado} y anular?
                  </span>
                  <button
                    type="button"
                    disabled={procesando !== null}
                    onClick={() => reembolsar(g)}
                    className="flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-danger px-3 text-sm font-semibold text-danger-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
                  >
                    {procesando === g.group_id && <LoaderCircle className="size-4 animate-spin" />}
                    Sí, reembolsar
                  </button>
                  <button
                    type="button"
                    disabled={procesando !== null}
                    onClick={() => setConfirmReembolso(null)}
                    className="h-9 cursor-pointer rounded-lg border border-border px-3 text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-40"
                  >
                    No
                  </button>
                </div>
              ) : (
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    disabled={resumen !== null || procesando !== null}
                    onClick={() => empezar(g)}
                    className="flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
                  >
                    Cobrar lo que falta
                  </button>
                  {reembolsoHabilitado && (
                    <button
                      type="button"
                      disabled={resumen !== null || procesando !== null}
                      onClick={() => setConfirmReembolso(g.group_id)}
                      className="h-9 cursor-pointer rounded-lg border border-border px-3 text-sm font-medium text-muted-foreground transition-colors hover:border-danger/40 hover:text-danger-ink disabled:opacity-40"
                    >
                      Reembolsar y anular
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {/* ---- Resumen de la pata pendiente (reusa los diálogos de cobro del POS) ---- */}
      {resumen?.fase === "card-ask" && (
        <ChoiceModal
          titulo="Falta la parte con tarjeta. ¿Débito o crédito?"
          monto={resumen.monto}
          onCerrar={() => setResumen(null)}
          opciones={[
            { icon: CreditCard, label: "Débito", primary: true, onClick: () => setResumen({ ...resumen, fase: "card-terminal", paymentType: "debit_card" }) },
            { icon: CreditCard, label: "Crédito", onClick: () => setResumen({ ...resumen, fase: "card-terminal", paymentType: "credit_card" }) },
          ]}
        />
      )}

      {resumen?.fase === "card-terminal" && (
        <CobroPointDialog
          amount={resumen.monto}
          paymentType={resumen.paymentType}
          crear={() =>
            crearCobroSplitPoint({
              items: items(resumen.grupo),
              pagos: resumen.grupo.split_pagos,
              leg_amount: resumen.monto,
              idempotency_key: claveLeg(resumen.grupo, "card"),
              group_id: resumen.grupo.group_id,
              leg_method: "card",
              payment_type: resumen.paymentType,
            })
          }
          onPagado={() => cerrar(resumen.grupo)}
          onFallback={() => setResumen(null)}
          fallbackLabel="Cancelar"
          onCerrar={() => setResumen(null)}
        />
      )}

      {resumen?.fase === "qr-ask" && (
        <ChoiceModal
          titulo="Falta la parte con QR. ¿Dónde lo cobrás?"
          monto={resumen.monto}
          onCerrar={() => setResumen(null)}
          opciones={[
            { icon: CreditCard, label: "En el posnet", primary: true, onClick: () => setResumen({ ...resumen, fase: "qr-terminal" }) },
            { icon: QrCode, label: "En pantalla", onClick: () => setResumen({ ...resumen, fase: "qr-pantalla" }) },
          ]}
        />
      )}

      {resumen?.fase === "qr-pantalla" && (
        <CobroQrDialog
          amount={resumen.monto}
          crear={() =>
            crearCobroSplit({
              items: items(resumen.grupo),
              pagos: resumen.grupo.split_pagos,
              leg_amount: resumen.monto,
              idempotency_key: claveLeg(resumen.grupo, "qr"),
              group_id: resumen.grupo.group_id,
              leg_method: "qr",
            })
          }
          onPagado={() => cerrar(resumen.grupo)}
          onCerrar={() => setResumen(null)}
        />
      )}

      {resumen?.fase === "qr-terminal" && (
        <CobroPointDialog
          amount={resumen.monto}
          crear={() =>
            crearCobroSplitPoint({
              items: items(resumen.grupo),
              pagos: resumen.grupo.split_pagos,
              leg_amount: resumen.monto,
              idempotency_key: claveLeg(resumen.grupo, "qr"),
              group_id: resumen.grupo.group_id,
              leg_method: "qr",
            })
          }
          onPagado={() => cerrar(resumen.grupo)}
          onFallback={() => setResumen({ ...resumen, fase: "qr-pantalla" })}
          fallbackLabel="Cobrar con QR en pantalla"
          onCerrar={() => setResumen(null)}
        />
      )}
    </section>
  );
}

/** Modal chico de elección (débito/crédito, posnet/pantalla) para el resumen. */
function ChoiceModal({
  titulo,
  monto,
  onCerrar,
  opciones,
}: {
  titulo: string;
  monto: number;
  onCerrar: () => void;
  opciones: { icon: typeof CreditCard; label: string; primary?: boolean; onClick: () => void }[];
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/75 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-popover p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">{titulo}</p>
            <p className="tabular text-2xl font-semibold">{money(monto)}</p>
          </div>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="cursor-pointer text-muted-foreground hover:text-foreground">
            <X className="size-5" />
          </button>
        </div>
        <div className="space-y-2">
          {opciones.map((o) => (
            <button
              key={o.label}
              type="button"
              onClick={o.onClick}
              className={
                "flex h-14 w-full cursor-pointer items-center gap-3 rounded-xl px-4 text-left text-sm font-semibold transition-colors " +
                (o.primary ? "bg-primary text-primary-foreground hover:opacity-90" : "border border-border text-foreground hover:bg-secondary")
              }
            >
              <o.icon className="size-5 shrink-0" />
              {o.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
