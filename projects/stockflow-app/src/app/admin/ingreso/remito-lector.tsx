"use client";

import { useRef, useState, useTransition } from "react";
import { FileText, Loader2, AlertTriangle, X, Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { money } from "@/lib/format";
import { leerRemitoDelProveedor, type LineaPropuesta } from "./actions";
import type { IngresoProduct } from "./ingreso-client";

/**
 * Cargar el ingreso desde la foto del remito.
 *
 * La regla que ordena toda la pantalla: **el modelo propone, el código valida,
 * el operario confirma**. El modelo solo transcribió renglones; el match contra
 * el catálogo lo hizo `ingreso_buscar` del lado del servidor; y acá el operario
 * elige producto por producto qué entra y qué no. Nada llega al stock sin que
 * alguien lo haya mirado — el confirmar final sigue siendo el de siempre.
 *
 * Las líneas sin match NO se ocultan: se muestran como "no lo encontré" para que
 * el operario las cargue a mano. Esconderlas haría que un renglón del remito
 * desaparezca sin que nadie se entere, que es peor que no leer el remito.
 */
export function RemitoLector({ onAgregar }: { onAgregar: (p: IngresoProduct, cantidad: number, costo: number | null) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [lineas, setLineas] = useState<LineaPropuesta[] | null>(null);
  const [usadas, setUsadas] = useState<Set<number>>(new Set());

  const subir = (file: File) => {
    setError(null);
    const fd = new FormData();
    fd.set("remito", file);
    startTransition(async () => {
      const r = await leerRemitoDelProveedor(fd);
      if (!r.ok) {
        setError(r.error);
        setLineas(null);
      } else {
        setLineas(r.lineas);
        setUsadas(new Set());
      }
    });
  };

  const cerrar = () => {
    setLineas(null);
    setError(null);
    setUsadas(new Set());
    if (input.current) input.current.value = "";
  };

  const sinMatch = lineas?.filter((l) => l.candidatos.length === 0).length ?? 0;

  return (
    <section className="mb-4">
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) subir(f);
        }}
      />

      {!lineas && (
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={pendiente}
          className={cn(
            "flex w-full cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border bg-card px-4 py-3 text-left transition-colors",
            pendiente ? "cursor-default opacity-60" : "hover:border-primary/40",
          )}
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground">
            {pendiente ? <Loader2 className="size-4.5 animate-spin" /> : <FileText className="size-4.5" />}
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-medium">
              {pendiente ? "Leyendo el remito…" : "Cargar desde el remito"}
            </span>
            <span className="block text-xs text-muted-foreground">
              {pendiente
                ? "Puede tardar unos segundos."
                : "Sacale una foto y te propongo los productos. Vos confirmás."}
            </span>
          </span>
        </button>
      )}

      {error && (
        <p className="mt-2 flex items-start gap-2 rounded-lg border border-danger/25 bg-danger/10 px-3.5 py-2.5 text-sm text-danger-ink">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}

      {lineas && (
        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                {lineas.length} {lineas.length === 1 ? "renglón leído" : "renglones leídos"}
              </p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Revisá cada uno antes de sumarlo.
                {sinMatch > 0 && ` ${sinMatch} no está${sinMatch === 1 ? "" : "n"} en tu catálogo: cargalo${sinMatch === 1 ? "" : "s"} a mano.`}
              </p>
            </div>
            <button
              type="button"
              onClick={cerrar}
              aria-label="Cerrar la lectura del remito"
              className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>

          <ul className="divide-y divide-border">
            {lineas.map((l, i) => {
              const elegido = l.candidatos[0];
              const yaEsta = usadas.has(i);
              return (
                <li key={i} className="px-4 py-3">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="text-sm font-medium">{l.texto}</span>
                    <span className="tabular text-xs text-muted-foreground">
                      {l.cantidad} u.
                      {l.costoUnitario != null && ` · ${money(l.costoUnitario)} c/u`}
                    </span>
                  </div>

                  {elegido ? (
                    <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
                      <span className="min-w-0 text-xs text-muted-foreground">
                        En tu catálogo:{" "}
                        <span className="text-foreground">
                          {elegido.emoji ? `${elegido.emoji} ` : ""}
                          {elegido.name}
                        </span>
                      </span>
                      <button
                        type="button"
                        disabled={yaEsta}
                        onClick={() => {
                          onAgregar(elegido, l.cantidad, l.costoUnitario);
                          setUsadas((prev) => new Set(prev).add(i));
                        }}
                        className={cn(
                          "shrink-0 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                          yaEsta
                            ? "cursor-default border-border text-muted-foreground"
                            : "cursor-pointer border-border bg-card hover:border-primary/40 hover:text-primary-ink",
                        )}
                      >
                        {yaEsta ? (
                          <span className="flex items-center gap-1">
                            <Check className="size-3.5" /> Agregado
                          </span>
                        ) : (
                          "Agregar"
                        )}
                      </button>
                    </div>
                  ) : (
                    <p className="mt-1.5 text-xs text-warning-ink">
                      No lo encontré en tu catálogo. Buscalo o escanealo abajo.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
