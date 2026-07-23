"use client";

import { useState, useTransition } from "react";
import { Check, LoaderCircle, TrendingDown, TrendingUp, X, Pencil } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { CountUp } from "@/components/ui/count-up";
import { cn } from "@/lib/cn";
import { AvisoBanner } from "@/components/ui/aviso";
import { money } from "@/lib/format";
import { aplicarPrecio } from "./actions";

export type ProductoErosionado = {
  id: string;
  name: string;
  emoji: string | null;
  color: string | null;
  precio: string;
  costo_hoy: string;
  margen_hoy: string;
  costo_original: string | null;
  margen_original: string | null;
  unidades_30d: string;
  precio_sugerido: string;
  precio_desde: string | null;
  plata_por_mes: string;
};

export type Erosionados = {
  min_margen: string;
  redondeo: string;
  productos: ProductoErosionado[];
  total_por_mes: string;
};

/**
 * Precios que se comió la inflación.
 *
 * El dato que ningún reporte muestra: tus reportes calculan el margen con el
 * costo al que VENDISTE, no con lo que te sale REPONER. En un país donde los
 * costos se mueven todos los meses, esos dos números se separan en silencio y el
 * kiosquero se entera cuando no le cierra la caja.
 */
export function PreciosClient({ datos }: { datos: Erosionados | null }) {
  const [resueltos, setResueltos] = useState<Set<string>>(new Set());
  const [aviso, setAviso] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [editando, setEditando] = useState<ProductoErosionado | null>(null);
  const [pendiente, setPendiente] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const productos = (datos?.productos ?? []).filter((p) => !resueltos.has(p.id));
  const minMargen = Number(datos?.min_margen ?? 25);

  // El total se recalcula sobre lo que queda: cada precio corregido lo baja.
  const totalPorMes = productos.reduce((a, p) => a + Number(p.plata_por_mes), 0);

  function aplicar(p: ProductoErosionado, precio: number) {
    setPendiente(p.id);
    setAviso(null);
    startTransition(async () => {
      const r = await aplicarPrecio(p.id, precio);
      setPendiente(null);
      setEditando(null);
      if (!r.ok) {
        setAviso({ tone: "error", text: r.error });
        return;
      }
      setResueltos((s) => new Set(s).add(p.id));
      setAviso({ tone: "ok", text: `${p.name} pasó a ${money(precio)}.` });
    });
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 lg:px-8 lg:py-8">
      <div className="mb-5">
        <PageHeader
          title="Precios"
          subtitle="Productos cuyo margen se achicó porque subió lo que te sale reponerlos."
          icon={TrendingUp}
        />
      </div>

      <AvisoBanner aviso={aviso} onClose={() => setAviso(null)} />

      {productos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-6 py-14 text-center">
          <Check className="mx-auto mb-3 size-8 text-success-ink" />
          <p className="text-sm font-medium">Tus precios están al día</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Ningún producto activo quedó por debajo del {minMargen}% de margen.
          </p>
        </div>
      ) : (
        <>
          {totalPorMes > 0 && (
            <div className="mb-4 rounded-xl border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">Estás dejando de ganar</p>
              <p className="text-3xl font-semibold tabular text-danger-ink lg:text-4xl">
                <CountUp value={totalPorMes} prefix="$ " />
                <span className="text-base font-normal text-muted-foreground"> por mes</span>
              </p>
              {/* Honestidad: es una proyección, no un hecho. Si sube el precio y
                  vende menos, el número no se cumple. Decirlo evita prometer. */}
              <p className="mt-1 text-xs text-muted-foreground">
                Calculado sobre lo que vendiste el último mes, si corregís los precios y seguís
                vendiendo lo mismo.
              </p>
            </div>
          )}

          <ul className="space-y-2">
            {productos.map((p) => {
              const margenHoy = Number(p.margen_hoy);
              const margenAntes = p.margen_original === null ? null : Number(p.margen_original);
              const cayo = margenAntes !== null && margenHoy < margenAntes - 1;
              const sugerido = Number(p.precio_sugerido);
              const actual = Number(p.precio);
              const plata = Number(p.plata_por_mes);

              return (
                <li key={p.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-start gap-3">
                    <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-lg bg-secondary text-xl">
                      {p.emoji ?? "📦"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{p.name}</p>

                      <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-sm">
                        <span
                          className={cn(
                            "font-medium tabular",
                            margenHoy < minMargen ? "text-danger-ink" : "text-warning-ink",
                          )}
                        >
                          Ganás {margenHoy}%
                        </span>
                        {cayo && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <TrendingDown className="size-3.5" />
                            antes {margenAntes}%
                          </span>
                        )}
                      </p>

                      <p className="mt-1 text-sm text-muted-foreground">
                        Te sale <strong className="text-foreground tabular">{money(Number(p.costo_hoy))}</strong>
                        {p.costo_original !== null && Number(p.costo_original) < Number(p.costo_hoy) && (
                          <> (antes {money(Number(p.costo_original))})</>
                        )}{" "}
                        y lo vendés a <strong className="text-foreground tabular">{money(actual)}</strong>.
                      </p>

                      {plata > 0 && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          Vendiste {Math.round(Number(p.unidades_30d))} en el último mes ·{" "}
                          <strong className="text-danger-ink tabular">{money(plata)}</strong> menos por mes
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      disabled={pendiente !== null}
                      onClick={() => aplicar(p, sugerido)}
                      className="flex h-10 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
                    >
                      {pendiente === p.id ? (
                        <LoaderCircle className="size-4 animate-spin" />
                      ) : null}
                      Poner a {money(sugerido)}
                    </button>
                    <button
                      type="button"
                      disabled={pendiente !== null}
                      onClick={() => setEditando(p)}
                      aria-label={`Poner otro precio a ${p.name}`}
                      className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-primary hover:text-foreground disabled:opacity-40"
                    >
                      <Pencil className="size-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          <p className="mt-4 text-xs text-muted-foreground">
            El precio sugerido recupera el margen que tenías cuando lo fijaste, redondeado al
            múltiplo de {money(Number(datos?.redondeo ?? 50))}. Vos decidís: si un producto lo
            tenés barato a propósito, dejalo.
          </p>
        </>
      )}

      {editando && (
        <OtroPrecio
          producto={editando}
          pendiente={pendiente !== null}
          onCancel={() => setEditando(null)}
          onAplicar={(precio) => aplicar(editando, precio)}
        />
      )}
    </div>
  );
}

/** Para el que quiere poner un número propio en vez del sugerido. */
function OtroPrecio({
  producto,
  pendiente,
  onCancel,
  onAplicar,
}: {
  producto: ProductoErosionado;
  pendiente: boolean;
  onCancel: () => void;
  onAplicar: (precio: number) => void;
}) {
  const [valor, setValor] = useState(String(Math.round(Number(producto.precio_sugerido))));
  const precio = Number(valor);
  const costo = Number(producto.costo_hoy);
  const margen = precio > 0 ? Math.round(((precio - costo) / precio) * 100) : 0;
  const valido = Number.isFinite(precio) && precio > 0;

  return (
    <div className="fixed inset-0 z-50 grid place-items-end overflow-y-auto bg-black/60 sm:place-items-center sm:p-4">
      <div className="w-full rounded-t-2xl border border-border bg-popover p-5 sm:max-w-sm sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold">{producto.name}</h2>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cerrar"
            className="cursor-pointer text-muted-foreground hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>

        <label htmlFor="otro-precio" className="text-sm font-medium">
          Nuevo precio
        </label>
        <input
          id="otro-precio"
          value={valor}
          onChange={(e) => setValor(e.target.value.replace(/[^\d.]/g, ""))}
          inputMode="decimal"
          autoFocus
          className="mt-1.5 h-12 w-full rounded-lg border border-input bg-background px-3 text-lg tabular outline-none focus:border-primary"
        />
        <p className="mt-1.5 text-sm text-muted-foreground">
          {valido ? (
            <>
              Te queda un margen de{" "}
              <strong className={cn("tabular", margen < 0 ? "text-danger-ink" : "text-foreground")}>
                {margen}%
              </strong>{" "}
              · ganás {money(precio - costo)} por unidad
            </>
          ) : (
            "Poné un número."
          )}
        </p>

        <button
          type="button"
          disabled={!valido || pendiente}
          onClick={() => onAplicar(precio)}
          className="mt-4 flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {pendiente && <LoaderCircle className="size-4 animate-spin" />}
          Guardar precio
        </button>
      </div>
    </div>
  );
}
