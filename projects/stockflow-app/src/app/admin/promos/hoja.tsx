"use client";

import { LoaderCircle } from "lucide-react";
import { money } from "@/lib/format";
import { Button } from "@/components/ui/button";

/**
 * Superficies compartidas entre la sección y el alta manual.
 *
 * Viven en su propio archivo y no en `promos-client` para que el alta pueda
 * usarlas sin que los dos módulos se importen en círculo.
 */

/**
 * Hoja anclada abajo: `max-h-[85dvh]`, scroll PROPIO del panel y la safe-area
 * de Android en el pie.
 *
 * El `max-h` va en el panel y no en el fondo negro a propósito (regla de
 * reparación del audit responsive): con `place-items-end`, un panel sin techo
 * derrama por ARRIBA, donde el scroll del overlay no llega — y la X de cerrar
 * y los primeros campos quedan inalcanzables con el teclado abierto.
 */
export function Hoja({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/60 sm:place-items-center sm:p-4">
      <div className="max-h-[85dvh] w-full overflow-y-auto rounded-t-2xl border border-border bg-popover p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:max-w-sm sm:rounded-2xl">
        {children}
      </div>
    </div>
  );
}

/**
 * Vender bajo costo: segundo tap, EN PESOS, nunca un checkbox.
 *
 * El piso de costo es POLÍTICA del dueño, no del algoritmo — hay casos donde
 * recuperar algo es mejor que tirar todo. Pero la decisión sólo es suya si ve
 * los dos números: lo que pierde por unidad y lo que recupera contra tirarlo.
 * "¿Estás seguro?" sin cifras no es una decisión, es un trámite.
 */
export function BajoCosto({
  costo,
  precio,
  stock,
  pendiente,
  onVolver,
  onConfirmar,
}: {
  costo: number;
  precio: number;
  stock: number;
  pendiente: boolean;
  onVolver: () => void;
  onConfirmar: () => void;
}) {
  return (
    <Hoja>
      <h2 className="text-sm font-semibold text-danger-ink">Vas a vender bajo costo</h2>
      <div className="mt-3 space-y-2 text-sm text-muted-foreground">
        <p>
          Te sale <strong className="tabular text-foreground">{money(costo)}</strong> y lo ponés a{" "}
          <strong className="tabular text-foreground">{money(precio)}</strong>: perdés{" "}
          <strong className="tabular text-danger-ink">{money(costo - precio)}</strong> por unidad.
        </p>
        {stock > 0 && (
          <p>
            Vendiendo las {stock} recuperás{" "}
            <strong className="tabular text-foreground">{money(precio * stock)}</strong>. Tirándolas
            perdés <strong className="tabular text-foreground">{money(costo * stock)}</strong>.
          </p>
        )}
      </div>

      <div className="mt-4 flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={onVolver}>
          Volver
        </Button>
        <button
          type="button"
          disabled={pendiente}
          onClick={onConfirmar}
          className="flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-danger/40 bg-danger/10 px-3 text-sm font-semibold text-danger-ink transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {pendiente && <LoaderCircle className="size-4 animate-spin" />}
          Sí, vender bajo costo
        </button>
      </div>
    </Hoja>
  );
}
