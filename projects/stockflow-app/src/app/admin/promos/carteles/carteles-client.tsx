"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";
import { Printer, ArrowLeft } from "lucide-react";
import { money } from "@/lib/format";
import { fechaCorta } from "@/lib/promos";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyArt } from "@/components/ui/empty-art";

export type Cartel = {
  promo_id: string;
  name: string;
  emoji: string | null;
  /** Unitario dentro del grupo. Con min_qty 1, el precio de promo a secas. */
  precio: string | number;
  /** 048 · "2 x $1.000" ⇒ 2. */
  min_qty: number;
  antes: string | number;
  ends_on: string;
  termina_hoy: boolean;
};

/**
 * Carteles de hoy.
 *
 * El uso primario es el celular parado frente a la góndola; la impresión es
 * secundaria pero real. Es una vista de LECTURA, deliberadamente pobre: un
 * cartel es un artefacto de salida, no una superficie de decisión.
 *
 * Lo que NO va, taxativo: costo, margen, ganancia, unidades, stock, y sobre
 * todo el MOTIVO del descuento. "Vence el sábado" escrito en la góndola mata
 * la venta — el motivo es del dueño, no del cliente.
 *
 * Sólo lo ACTIVO hoy (la RPC ya filtra): un cartel puesto hoy con el precio de
 * mañana es exactamente el desfasaje cartel↔caja que la feature existe para
 * evitar.
 */
export function CartelesClient({ carteles }: { carteles: Cartel[] }) {
  const terminanHoy = carteles.filter((c) => c.termina_hoy).length;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 lg:px-8 lg:py-8">
      {/* Toda la cabecera es pantalla, no papel. */}
      <div className="mb-5 print:hidden">
        <Link
          href="/admin/promos"
          className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Volver a Promos
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Carteles de hoy</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Lo que tiene que decir cada cartel de la góndola para que coincida con lo que cobra la
              caja.
            </p>
          </div>
          {carteles.length > 0 && (
            <Button variant="secondary" onClick={() => window.print()}>
              <Printer className="size-4" /> Imprimir
            </Button>
          )}
        </div>
      </div>

      {terminanHoy > 0 && (
        <p className="mb-4 rounded-lg border border-border bg-warning/10 px-3 py-2 text-sm text-warning-ink print:hidden">
          {terminanHoy === 1
            ? "1 promo termina hoy — acordate de sacar ese cartel al cerrar."
            : `${terminanHoy} promos terminan hoy — acordate de sacar esos carteles al cerrar.`}
        </p>
      )}

      {carteles.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-6 py-14 text-center print:hidden">
          <EmptyArt name="precios" alt="Una etiqueta de precio colgando" />
          <p className="text-sm font-medium">No hay carteles para hoy</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Cuando pongas una promo, el cartel aparece acá listo para imprimir.
          </p>
          <ButtonLink href="/admin/promos" variant="secondary" className="mt-4">
            Ver promos
          </ButtonLink>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 print:grid-cols-2 print:gap-[6mm]">
          {carteles.map((c) => {
            /* "$12.500" a 64pt mide ~105mm y desborda los ~92mm de la celda A4:
               los precios largos bajan un escalón. Condicional por longitud del
               string YA formateado — nada de auto-fit con JS. */
            const precioTexto =
              c.min_qty > 1 ? money(Number(c.precio) * c.min_qty) : money(Number(c.precio));
            /* El ancho lo manda el string COMPLETO del hero: en una promo de
               grupo el "2x " suma ~3 caracteres que un umbral sobre el precio
               solo no ve (y desbordaba la celda A4 por 100px). */
            const largoHero = precioTexto.length + (c.min_qty > 1 ? String(c.min_qty).length + 2 : 0);
            const chico = largoHero > 7;

            return (
              <li
                key={c.promo_id}
                /* PÓSTER, no recibo: anatomía centrada con marco sólido — el
                   marco ES el cartel y se corta por afuera de él. La preview en
                   pantalla y el papel comparten estructura para que lo que se
                   ve en el celu sea lo que sale de la impresora. En papel el
                   gap entre marcos es la guía de tijera (el punteado pegado al
                   vecino destruía el marco de al lado al cortar). */
                className="flex flex-col items-center rounded-lg border-[3px] border-foreground/80 bg-card p-5 text-center print:h-[128mm] print:break-inside-avoid print:rounded-none print:border-[3pt] print:p-[6mm]"
              >
                {/* La palabra que declara el género, entre REGLAS y nunca sobre
                    fondo negro: la impresión tira los fondos a propósito
                    (ahorro de tinta), los bordes imprimen siempre. */}
                <p className="w-full border-y-2 border-foreground/80 py-1 text-center text-sm font-black uppercase tracking-[0.3em] print:border-y-[2pt] print:py-[2mm] print:text-[20pt]">
                  Oferta
                </p>

                <p className="mt-3 text-lg font-semibold leading-tight print:text-[18pt]">
                  {/* Sin truncar, sin excepción: si el cartel corta el nombre,
                      el cartel está mal — no hay pantalla siguiente. */}
                  {c.name}
                </p>

                {/* El bloque del precio domina el centro vertical (my-auto). */}
                <div className="my-auto py-3">
                  {c.min_qty > 1 ? (
                    <>
                      <p
                        className={cn(
                          "tabular whitespace-nowrap font-black leading-none tracking-tight",
                          chico
                            ? "text-4xl print:text-[36pt]"
                            : "text-5xl print:text-[44pt]",
                        )}
                      >
                        <span className={chico ? "text-2xl print:text-[24pt]" : "text-3xl print:text-[30pt]"}>
                          {c.min_qty}x{" "}
                        </span>
                        {precioTexto}
                      </p>
                      {/* La unidad suelta es un HECHO, no una rebaja: sin tachar. */}
                      <p className="tabular mt-2 text-sm text-muted-foreground print:text-[13pt]">
                        Llevando 1: {money(Number(c.antes))}
                      </p>
                    </>
                  ) : (
                    <>
                      <s className="tabular text-sm text-muted-foreground print:text-[13pt]">
                        Antes {money(Number(c.antes))}
                      </s>
                      <p
                        className={cn(
                          "tabular mt-1 whitespace-nowrap font-black leading-none tracking-tight",
                          chico
                            ? "text-5xl print:text-[48pt]"
                            : "text-6xl print:text-[64pt]",
                        )}
                      >
                        {precioTexto}
                      </p>
                    </>
                  )}
                </div>

                {/* La fecha, chica y anclada abajo: el cartel carga su propio
                    vencimiento y nadie tiene que acordarse de qué día es. */}
                <p className="mt-auto text-xs text-muted-foreground print:text-[10pt]">
                  {c.termina_hoy ? "Válido solo hoy" : `Válido hasta el ${fechaCorta(c.ends_on)}`}
                </p>

                {c.termina_hoy && (
                  <p className="mt-1 text-xs font-semibold text-warning-ink print:hidden">
                    termina hoy — sacalo al cerrar
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
