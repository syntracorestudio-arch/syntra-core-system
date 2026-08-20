"use client";

import { PackageSearch, CalendarClock, AlertTriangle, TrendingUp } from "lucide-react";
import { Card, CardAlert, CardList } from "@/components/ui/card-system";
import { PageHeader, HeaderStat } from "@/components/ui/page-header";
import { EmptyArt } from "@/components/ui/empty-art";
import { CountUp } from "@/components/ui/count-up";
import { cn } from "@/lib/cn";

/**
 * 052 · El reporte del EMPLEADO. No es el del dueño con cosas tachadas: es otra
 * pregunta.
 *
 * La del dueño es "¿cuánto gané?". La de quien atiende y repone es "¿qué se
 * está acabando y a qué hora se llena esto?". Por eso acá no falta plata —
 * simplemente no es de lo que trata la pantalla, y `reportes_reposicion` (SQL)
 * no la calcula ni la manda.
 *
 * Todo lo que se muestra son CANTIDADES: unidades, tickets, stock. Si alguna
 * vez aparece un `$` en este archivo, algo se rompió del lado del contrato.
 *
 * COMPOSICIÓN (dirección del design-director). La primera versión eran seis
 * `Card` idénticas apiladas en una columna de 768px: a 1920 sobraba el 54% del
 * ancho y el protagonista —qué reponer— aparecía cuarto, con el mismo peso
 * tipográfico que el resto. Ahora:
 *   · el ancho es `max-w-6xl`, la medida que ya usan Resumen y Reportes;
 *   · los niveles del card-system separan qué es qué (alerta ≠ colección ≠
 *     card neutra), que era el "todas genéricas";
 *   · en ≥1024 va bento de 12 columnas: las dos listas de ACCIÓN a la
 *     izquierda, el contexto a la derecha, el ritmo abajo a lo ancho.
 */

export type ReposicionData = {
  period: { from: string; to: string; days: number };
  volumen: {
    units: number;
    tickets: number;
    prev_units: number;
    vs_prev_pct: number | null;
  };
  top_units: { name: string; emoji: string | null; units: number }[];
  by_date: { fecha: string; tickets: number; units: number }[];
  by_slot: { name: string; tickets: number }[];
  low_stock: { name: string; emoji: string | null; stock: number; stock_confiable: boolean }[];
  expiring: {
    name: string;
    emoji: string | null;
    expiry_date: string;
    qty: number;
    days_left: number;
  }[];
};

const num = (n: number | string) =>
  new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(Number(n));

/** Título de bloque. El protagonista pesa; el contexto no. */
function TituloBloque({
  icon: Icon,
  tone,
  children,
  count,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone: "warning" | "danger" | "neutral";
  children: React.ReactNode;
  count?: number;
}) {
  return (
    <div className="mb-3 flex items-center gap-2.5">
      <span
        aria-hidden
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-lg ring-1",
          tone === "warning" && "bg-warning/15 text-warning-ink ring-warning/30",
          tone === "danger" && "bg-danger/15 text-danger-ink ring-danger/30",
          tone === "neutral" && "bg-primary/12 text-primary ring-primary/25",
        )}
      >
        <Icon className="size-4" />
      </span>
      <h2 className="flex-1 text-base font-semibold text-foreground">{children}</h2>
      {count !== undefined && count > 0 && (
        <span className="tabular rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {num(count)}
        </span>
      )}
    </div>
  );
}

export function ReposicionClient({
  data,
  subtitulo,
}: {
  data: ReposicionData | null;
  subtitulo: string;
}) {
  if (!data) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 lg:px-8">
        <p className="text-sm text-muted-foreground">No pudimos cargar el reporte.</p>
      </div>
    );
  }

  const { volumen, top_units, by_slot, low_stock, expiring } = data;
  /* Las cuatro franjas SIEMPRE, aunque una no haya vendido: el gráfico
     responde "a qué hora se llena", y un día al que le faltan dos franjas no
     se lee como un día. La RPC sólo devuelve las que tuvieron ventas. */
  const FRANJAS = ["Mañana", "Mediodía", "Tarde", "Noche"];
  const franjas = FRANJAS.map((name) => ({
    name,
    tickets: Number(by_slot.find((f) => f.name === name)?.tickets ?? 0),
  }));
  const maxTickets = Math.max(1, ...franjas.map((f) => f.tickets));
  const maxUnits = Math.max(1, ...top_units.map((t) => Number(t.units)));
  const vsPrev = volumen.vs_prev_pct === null ? null : Number(volumen.vs_prev_pct);
  const vsPrevCaption =
    vsPrev === null ? null : `${vsPrev >= 0 ? "+" : ""}${num(vsPrev)}% vs. antes`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8 lg:py-8">
      <div className="mb-5">
        <PageHeader
          title="Qué se vende"
          subtitle={subtitulo}
          icon={PackageSearch}
          art="reportes"
          /* El número de la banda es el VOLUMEN, que es contexto de una línea.
             El protagonista de la pantalla no es un número: es la lista de lo
             que hay que reponer, y por eso vive en una card y no acá. */
          stat={
            <HeaderStat
              value={<CountUp value={Number(volumen.units)} />}
              caption={
                vsPrevCaption
                  ? `unidades · ${num(volumen.tickets)} ventas · ${vsPrevCaption}`
                  : `unidades · ${num(volumen.tickets)} ventas`
              }
            />
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        {/* ---- ACCIÓN: las dos listas con las que se trabaja ---------------- */}
        <div className="space-y-4 lg:col-span-7">
          {/* EL PROTAGONISTA. Alerta, no card neutra: hay algo que hacer. */}
          <CardAlert tone="warning">
            <TituloBloque icon={AlertTriangle} tone="warning" count={low_stock.length}>
              Se está por acabar
            </TituloBloque>
            {low_stock.length === 0 ? (
              /* Compacto a propósito: cuando no hay nada que reponer, la
                 buena noticia es UNA línea. Con la ilustración centrada este
                 bloque —el protagonista— quedaba como un hueco de 300px
                 diciendo que no pasa nada. */
              <div className="flex items-center gap-3 py-1">
                <EmptyArt
                  name="productos"
                  alt="Cajas apiladas en una góndola"
                  className="size-12"
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium">La góndola está cubierta</p>
                  <p className="text-sm text-muted-foreground">
                    Nada de lo que se vende está por debajo del mínimo.
                  </p>
                </div>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {low_stock.map((p) => (
                  <li key={p.name} className="flex items-center gap-3 py-2.5">
                    <span aria-hidden className="w-5 shrink-0 text-center">
                      {p.emoji ?? "📦"}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm">{p.name}</span>
                    {!p.stock_confiable && (
                      <span className="shrink-0 text-xs text-muted-foreground">sin contar</span>
                    )}
                    <span
                      className={cn(
                        "tabular w-14 shrink-0 text-right text-sm font-semibold",
                        Number(p.stock) <= 0 ? "text-danger-ink" : "text-warning-ink",
                      )}
                    >
                      {num(p.stock)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardAlert>

          {/* Colección, no alerta: `CardList` tiene su propio fondo. */}
          {top_units.length > 0 && (
            <CardList>
              <TituloBloque icon={TrendingUp} tone="neutral">
                Lo que más sale
              </TituloBloque>
              <ol className="space-y-0.5">
                {top_units.map((t, i) => {
                  const pct = (Number(t.units) / maxUnits) * 100;
                  return (
                    /* Bar-in-row: la barra es el FONDO de la fila y usa todo el
                       ancho disponible. La versión anterior tenía una barra de
                       96px fija al lado del nombre — a esa escala dos productos
                       con 60 y 2 unidades se veían casi iguales. */
                    <li key={t.name} className="relative isolate flex items-center gap-3 rounded-md px-2 py-2">
                      <span
                        aria-hidden
                        className={cn(
                          "absolute inset-y-0 left-0 -z-10 rounded-md",
                          i < 3 ? "bg-primary/25" : "bg-primary/10",
                        )}
                        style={{ width: `${Math.max(pct, 2)}%` }}
                      />
                      <span className="tabular w-5 shrink-0 text-xs text-muted-foreground">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span aria-hidden className="w-5 shrink-0 text-center">
                        {t.emoji ?? "📦"}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm">{t.name}</span>
                      <span className="tabular shrink-0 text-sm font-semibold">
                        {num(t.units)}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </CardList>
          )}
        </div>

        {/* ---- CONTEXTO: el pulso y lo que vence -------------------------- */}
        <div className="space-y-4 lg:col-span-5">
          {expiring.length > 0 && (
            <CardAlert tone="danger">
              <TituloBloque icon={CalendarClock} tone="danger" count={expiring.length}>
                Vence pronto
              </TituloBloque>
              <ul className="divide-y divide-border">
                {expiring.map((e, i) => (
                  <li key={`${e.name}-${e.expiry_date}-${i}`} className="flex items-center gap-3 py-2.5">
                    <span aria-hidden className="w-5 shrink-0 text-center">
                      {e.emoji ?? "📦"}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm">{e.name}</span>
                    <span className="tabular shrink-0 text-xs text-muted-foreground">
                      {num(e.qty)} u.
                    </span>
                    <span
                      className={cn(
                        "tabular w-16 shrink-0 text-right text-xs font-medium",
                        Number(e.days_left) <= 3 ? "text-danger-ink" : "text-warning-ink",
                      )}
                    >
                      {Number(e.days_left) <= 0
                        ? "vencido"
                        : `${num(e.days_left)} d`}
                    </span>
                  </li>
                ))}
              </ul>
            </CardAlert>
          )}
        </div>

        {/* ---- RITMO: a lo ancho, que es lo que le sobraba a la pantalla --- */}
        {by_slot.length > 0 && (
          <Card className="lg:col-span-12">
            <h2 className="mb-4 text-sm font-medium text-muted-foreground">
              A qué hora se llena
            </h2>
            {/* Columnas verticales y no barras horizontales: cuatro franjas en
                filas desperdiciaban todo el ancho y no se leían como un día.
                Así el turno se ve de un vistazo, que es la pregunta. */}
            <div className="flex h-32 items-end gap-3 sm:gap-6">
              {franjas.map((f) => {
                const pct = (f.tickets / maxTickets) * 100;
                const pico = f.tickets === maxTickets && f.tickets > 0;
                return (
                  <div key={f.name} className="flex h-full flex-1 flex-col justify-end gap-1.5">
                    <span
                      className={cn(
                        "tabular text-center text-xs font-semibold",
                        pico ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {num(f.tickets)}
                    </span>
                    <span
                      aria-hidden
                      className={cn(
                        /* 200ms. Anima `height`, que el presupuesto desaconseja —pero
                           acá el contenedor del gráfico tiene alto fijo, así que
                           la barra creciendo no mueve nada afuera ni produce CLS.
                           Lo que sí había que corregir es el medio segundo. */
                        "w-full rounded-t-md transition-[height] duration-200",
                        pico ? "bg-primary" : "bg-primary/35",
                      )}
                      style={{ height: `${Math.max(pct, 2)}%` }}
                    />
                    <span className="truncate text-center text-xs text-muted-foreground">
                      {f.name}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
