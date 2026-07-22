"use client";

import { useState, useTransition } from "react";
import { TriangleAlert, LoaderCircle, Check } from "lucide-react";
import { money } from "@/lib/format";
import { recuperarVenta } from "./actions";

export type CobroHuerfano = {
  id: string;
  monto: string;
  items: { product_id: string | null; qty: number }[];
  idempotency_key: string;
  client_id: string | null;
  cuando: string;
};

/**
 * Cobros con QR que se acreditaron y nunca llegaron a ser una venta.
 *
 * Pasa cuando la caja se cierra o se corta internet justo después de que el
 * cliente pagó: la plata entró, el stock no se descontó y la venta no existe.
 * Enterrarlo sería la peor opción — el kiosquero descubriría el descuadre días
 * después sin saber de dónde salió. Acá aparece arriba de todo, con el monto y
 * un botón para registrarlo.
 */
export function CobrosHuerfanos({ cobros }: { cobros: CobroHuerfano[] }) {
  const [resueltos, setResueltos] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pendiente, setPendiente] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const visibles = cobros.filter((c) => !resueltos.has(c.id));
  if (visibles.length === 0) return null;

  return (
    <section className="mb-4 rounded-xl bg-warning/10 p-4 ring-1 ring-warning/25">
      <div className="mb-2 flex items-start gap-2">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning-ink" />
        <div>
          <h2 className="text-sm font-medium text-warning-ink">
            {visibles.length === 1
              ? "Un cobro con QR quedó sin registrar"
              : `${visibles.length} cobros con QR quedaron sin registrar`}
          </h2>
          <p className="text-sm text-muted-foreground">
            El cliente pagó pero la venta no se guardó. Registrala para que el stock y el total
            del día queden bien.
          </p>
        </div>
      </div>

      {error && <p className="mb-2 text-sm text-danger-ink">{error}</p>}

      <ul className="space-y-1.5">
        {visibles.map((c) => (
          <li
            key={c.id}
            className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium tabular">{money(Number(c.monto))}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(c.cuando).toLocaleString("es-AR", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                })}{" "}
                · {c.items.reduce((a, i) => a + i.qty, 0)} unidades
              </p>
            </div>
            <button
              type="button"
              disabled={pendiente !== null}
              onClick={() => {
                setPendiente(c.id);
                setError(null);
                startTransition(async () => {
                  const r = await recuperarVenta(c.id);
                  setPendiente(null);
                  if (!r.ok) {
                    setError(r.error);
                    return;
                  }
                  setResueltos((s) => new Set(s).add(c.id));
                });
              }}
              className="flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {pendiente === c.id ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              Registrar
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
