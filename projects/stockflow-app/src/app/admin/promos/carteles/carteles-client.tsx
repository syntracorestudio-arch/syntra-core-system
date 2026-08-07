"use client";

import Link from "next/link";
import { Printer, ArrowLeft } from "lucide-react";
import { money } from "@/lib/format";
import { fechaCorta } from "@/lib/promos";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyArt } from "@/components/ui/empty-art";

export type Cartel = {
  promo_id: string;
  name: string;
  emoji: string | null;
  precio: string | number;
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
        <ul className="space-y-3 print:grid print:grid-cols-2 print:gap-0 print:space-y-0">
          {carteles.map((c) => (
            <li
              key={c.promo_id}
              /* En papel: media hoja A4 por cartel, borde punteado como guía de
                 tijera y `break-inside-avoid` para que ninguno quede partido
                 entre dos páginas. */
              className="rounded-xl border border-border bg-card p-5 print:h-[130mm] print:break-inside-avoid print:rounded-none print:border print:border-dashed print:p-8"
            >
              <p className="text-lg font-semibold leading-tight print:text-[16pt]">
                {/* Sin truncar, sin excepción: si el cartel corta el nombre, el
                    cartel está mal — no hay una pantalla siguiente donde leerlo. */}
                <span aria-hidden className="print:hidden">{c.emoji ? `${c.emoji} ` : ""}</span>
                {c.name}
              </p>

              <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="tabular whitespace-nowrap text-5xl font-bold tracking-tight print:text-[40pt] print:leading-none">
                  {money(Number(c.precio))}
                </span>
                <s className="tabular text-xl font-medium text-muted-foreground print:text-[18pt]">
                  <span className="sr-only">antes </span>
                  {money(Number(c.antes))}
                </s>
              </div>

              <p className="mt-2 text-sm text-muted-foreground print:text-[11pt]">
                {/* En papel la fecha se vuelve "hoy": el cartel carga su propio
                    vencimiento y nadie tiene que acordarse de qué día es. */}
                <span className="print:hidden">
                  {c.termina_hoy ? "Último día" : `Hasta el ${fechaCorta(c.ends_on)}`}
                </span>
                <span className="hidden print:inline">
                  {c.termina_hoy ? "Válido solo hoy" : `Válido hasta el ${fechaCorta(c.ends_on)}`}
                </span>
              </p>

              {c.termina_hoy && (
                <p className="mt-2 text-xs font-semibold text-warning-ink print:hidden">termina hoy</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
