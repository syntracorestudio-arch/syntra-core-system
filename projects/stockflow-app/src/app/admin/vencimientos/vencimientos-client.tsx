"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  Clock,
  Check,
  Trash2,
  Bell,
  BellRing,
  X,
  LoaderCircle,
  CalendarPlus,
  CalendarClock,
  Tag,
  ArrowRight,
  ChevronDown,
  MoreHorizontal,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { money } from "@/lib/format";
import { fechaCorta } from "@/lib/promos";
import { AvisoBanner } from "@/components/ui/aviso";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyArt } from "@/components/ui/empty-art";
import { Button } from "@/components/ui/button";
import { CardList } from "@/components/ui/card-system";
import { BuscadorProducto } from "./buscador-producto";
import type { IngresoBuscado } from "@/app/admin/productos/actions";
import { resolveExpiry, subscribeToPush, sendTestPush } from "./actions";
import { addExpiry } from "@/app/admin/configuracion/actions";
import { crearPromo } from "@/app/admin/promos/actions";

export type ExpiryRow = {
  id: string;
  productName: string;
  productEmoji: string | null;
  expiryDate: string;
  qty: number;
  daysLeft: number;
  /* 070 · cantidad × precio de venta. Es LO QUE DEJA DE VENDERSE, no lo que se
     pierde: si se tira, lo que se pierde es el costo. Se etiqueta "en venta" /
     "en riesgo" en toda la pantalla y nunca "perdés $X" — `cost` es owner-only
     por GRANT y no puede entrar a la vista sin romperle la sección al staff. */
  valorVenta: number;
};

type Aviso = { tone: "ok" | "error"; text: string } | null;

/** Urgencia por días restantes. El color refuerza, pero el texto lo dice solo. */
function urgencia(days: number): { label: string; tone: "danger" | "warning" | "muted" } {
  if (days < 0) return { label: `venció hace ${Math.abs(days)} d.`, tone: "danger" };
  if (days === 0) return { label: "vence hoy", tone: "danger" };
  if (days === 1) return { label: "vence mañana", tone: "danger" };
  if (days <= 7) return { label: `en ${days} días`, tone: "warning" };
  return { label: `en ${days} días`, tone: "muted" };
}

/** Lo que necesita la franja de promo. Espejo parcial de `promos_sugeridas`. */
export type SugerenciaPromo = {
  expiry_id: string;
  product_id: string;
  name: string;
  expiry_date: string;
  sugerido: number | string;
  cost: number | string | null;
  aplicable: boolean;
  es_reescalon: boolean;
};

export function VencimientosClient({
  expiries,
  sugerencias,
  hoy,
  warningDays,
  canEdit,
  truncado,
  vapidPublicKey,
}: {
  expiries: ExpiryRow[];
  sugerencias: SugerenciaPromo[];
  hoy: string;
  warningDays: number;
  canEdit: boolean;
  truncado: boolean;
  vapidPublicKey: string | null;
}) {
  const [aviso, setAviso] = useState<Aviso>(null);
  const [agregando, setAgregando] = useState(false);
  const [tirando, setTirando] = useState<ExpiryRow | null>(null);
  const [puestas, setPuestas] = useState<Map<string, number>>(new Map());
  const [pending, startTransition] = useTransition();

  const porVencimiento = useMemo(
    () => new Map(sugerencias.map((s) => [s.expiry_id, s])),
    [sugerencias],
  );

  /* LOS DOS GRUPOS. No son dos estéticas: son dos TRABAJOS distintos.
     · Por vencer  = todavía es mercadería. Se puede rematar, mover al frente,
                     devolver. La tarea es DECIDIR, y tiene ventana.
     · Vencido     = ya no es mercadería, es un registro contable abierto que
                     además está mintiendo sobre el stock. La tarea es CERRARLO.
     Por eso "por vencer" lidera: es la acción que todavía crea valor, y es el
     estado normal de un negocio sano. */
  const porVencer = useMemo(
    () =>
      expiries
        .filter((e) => e.daysLeft >= 0)
        /* Ordenado por FECHA y no por plata: acá el recurso escaso es el
           tiempo —una promo tarda en surtir efecto— y la plata es la columna
           que justifica el esfuerzo, no la que ordena. */
        .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate)),
    [expiries],
  );

  const vencidos = useMemo(
    () =>
      expiries
        .filter((e) => e.daysLeft < 0)
        /* Acá SÍ ordena la plata: ya no hay tiempo que ganar, así que se
           resuelve primero lo caro. */
        .sort((a, b) => b.valorVenta - a.valorVenta),
    [expiries],
  );

  const valorPorVencer = porVencer.reduce((t, e) => t + e.valorVenta, 0);
  const valorVencido = vencidos.reduce((t, e) => t + e.valorVenta, 0);
  const unidadesVencidas = vencidos.reduce((t, e) => t + e.qty, 0);

  function resolver(e: ExpiryRow, resolution: "sold" | "wasted", qty?: number) {
    startTransition(async () => {
      const res = await resolveExpiry(e.id, resolution, resolution === "wasted" ? (qty ?? e.qty) : null);
      if (!res.ok) {
        setAviso({ tone: "error", text: res.error });
        return;
      }
      setTirando(null);
      const base =
        resolution === "sold"
          ? "Marcado como vendido."
          : res.restante > 0
            ? `Registrada la merma. Quedan ${res.restante} u. con su fecha.`
            : "Registrada la merma.";
      setAviso({
        tone: "ok",
        /* Resolver el lote cierra la promo que lo liquidaba: callarlo deja al
           dueño con un cartel de promo puesto y la caja cobrando el precio de
           lista. */
        text:
          res.promosTerminadas > 0
            ? `${base} La promo terminó y el precio vuelve al de siempre.`
            : base,
      });
    });
  }

  function ponerEnPromo(s: SugerenciaPromo) {
    startTransition(async () => {
      const precio = Number(s.sugerido);
      const r = await crearPromo({
        productId: s.product_id,
        promoPrice: precio,
        startsOn: hoy,
        endsOn: s.expiry_date,
        expiryId: s.expiry_id,
        origin: "sugerida",
        belowCostOk: false,
        reemplazar: s.es_reescalon,
      });
      if (!r.ok) {
        setAviso({ tone: "error", text: r.error });
        return;
      }
      setPuestas((m) => new Map(m).set(s.expiry_id, precio));
    });
  }

  return (
    /* `max-w-6xl` y no `3xl`: el límite es LOCAL de esta ruta (el AppShell es
       `flex-1`, sin ancho), así que ensancharla no toca a ninguna otra
       sección. 6xl es además el ancho que ya usan las otras cinco listas de
       escritorio — baja el vocabulario de anchos en vez de ampliarlo. */
    <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8 lg:py-8">
      <div className="mb-5">
        <PageHeader
          title="Vencimientos"
          subtitle={
            expiries.length === 0
              ? `No tenés nada por vencer · te avisamos ${warningDays} ${warningDays === 1 ? "día" : "días"} antes`
              /* Los dos trabajos, contados por separado. Antes decía "6
                 pendientes · 6 requieren atención", que suma papeleo del pasado
                 con plata salvable en un número que no dirige a nada. */
              : `${porVencer.length} por vencer · ${vencidos.length} vencido${vencidos.length === 1 ? "" : "s"} sin resolver`
          }
          icon={CalendarClock}
          art="vencimientos"
          stat={
            valorPorVencer > 0 ? (
              <>
                <p className="tabular text-lg font-semibold">{money(valorPorVencer)}</p>
                <p className="text-xs text-muted-foreground">
                  en venta por vencer{truncado ? " (parcial)" : ""}
                </p>
              </>
            ) : null
          }
        >
          {canEdit && (
            <Button variant="secondary" className="bg-background/60" onClick={() => setAgregando(true)}>
              <CalendarPlus className="size-4" /> Cargar vencimiento
            </Button>
          )}
        </PageHeader>
      </div>

      {/* `PageHeader.stat` es `hidden sm:block`, así que en el teléfono el total
          desaparecería — y el teléfono es justo donde estás parado en la
          góndola. Esta línea lo repone abajo de sm y sólo ahí. */}
      {valorPorVencer > 0 && (
        <p className="tabular mb-4 text-sm sm:hidden">
          <span className="font-semibold">{money(valorPorVencer)}</span>{" "}
          <span className="text-muted-foreground">
            en venta por vencer{truncado ? " (parcial)" : ""}
          </span>
        </p>
      )}

      <PushCard vapidPublicKey={vapidPublicKey} onAviso={setAviso} />

      <AvisoBanner aviso={aviso} onClose={() => setAviso(null)} />

      {expiries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-6 py-14 text-center">
          <EmptyArt name="vencimientos" alt="Un calendario con un tilde" />
          <p className="text-sm font-medium">Todo al día</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Cargá la fecha de vencimiento cuando recibís mercadería y te avisamos antes.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* ── POR VENCER · lidera ─────────────────────────────────────── */}
          <section>
            <h2 className="mb-2 flex flex-wrap items-baseline gap-x-2 px-1 text-sm font-semibold">
              Por vencer
              {porVencer.length > 0 && (
                <span className="tabular text-xs font-normal text-muted-foreground">
                  {porVencer.length} {porVencer.length === 1 ? "lote" : "lotes"} ·{" "}
                  {money(valorPorVencer)} en venta
                </span>
              )}
            </h2>

            {porVencer.length === 0 ? (
              /* Vacío PROPIO, no la lista de vencidos disfrazada de alerta
                 activa: que no haya nada por vencer es una buena noticia y hay
                 que decirla. */
              <div className="rounded-xl border border-dashed border-border px-6 py-8 text-center text-sm text-muted-foreground">
                Nada por vencer en los próximos días.
              </div>
            ) : (
              /* `CardList` y no un `<ul>` con el hex a mano: la superficie de
                 colección vive en `card-system.tsx`, y ése es el ÚNICO lugar
                 donde puede haber un color hardcodeado (gate #1 y #3). Cuando
                 aterricen los tokens `--surface-*` del Anexo C, el cambio es un
                 find/replace en ese archivo y esta ruta no se entera.
                 `p-0` porque las filas traen su propio padding. */
              <CardList className="overflow-hidden p-0 lg:p-0">
                <ul className="divide-y divide-border">
                {porVencer.map((e) => (
                  <Fila
                    key={e.id}
                    e={e}
                    canEdit={canEdit}
                    pending={pending}
                    sugerencia={porVencimiento.get(e.id)}
                    yaPuesta={puestas.get(e.id)}
                    onPromo={ponerEnPromo}
                    onVendido={() => resolver(e, "sold")}
                    onTirar={() => setTirando(e)}
                  />
                ))}
                </ul>
              </CardList>
            )}
          </section>

          {/* ── VENCIDO · colapsado, pero diciendo su costo en datos ────── */}
          {vencidos.length > 0 && (
            <GrupoVencidos
              items={vencidos}
              unidades={unidadesVencidas}
              valor={valorVencido}
              canEdit={canEdit}
              pending={pending}
              onVendido={(e) => resolver(e, "sold")}
              onTirar={(e) => setTirando(e)}
            />
          )}
        </div>
      )}

      {agregando && (
        <AddExpiryDialog
          onClose={() => setAgregando(false)}
          onDone={() => {
            setAgregando(false);
            setAviso({ tone: "ok", text: "Vencimiento cargado." });
          }}
          onError={(text) => setAviso({ tone: "error", text })}
        />
      )}

      {tirando && (
        <DialogoMerma
          e={tirando}
          pending={pending}
          onCancelar={() => setTirando(null)}
          onConfirmar={(qty) => resolver(tirando, "wasted", qty)}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   LA FILA — 5 lanes, protagonista la plata
   ═════════════════════════════════════════════════════════════════════════ */

/**
 * Una fila de la cola.
 *
 * De 117px a ~44px, y el dato por el que existe la pantalla —la plata— pasa a
 * ser el ÚNICO máximo de contraste de la fila. Antes el máximo era el nombre,
 * empatado seis veces, y no había un solo peso en pantalla: el dueño no podía
 * saber si ese lote eran $500 o $48.000, que es exactamente lo que lo haría
 * actuar.
 *
 * La fila YA NO ES UNA CARD (se fue `border + bg-card` por ítem): las cards
 * dentro de la colección eran card-in-card, prohibido por §2.A, y aplanaban la
 * jerarquía a un solo nivel repetido.
 *
 * UNA sola acción primaria, y cambia según el grupo. Antes un lote vencido
 * ofrecía "Se vendió" con el mismo peso que "Tuve que tirarlo": dos botones de
 * peso igual invitan a tocar cualquiera para sacarlo de la lista, y ese toque
 * miente en el ledger.
 */
function Fila({
  e,
  canEdit,
  pending,
  sugerencia,
  yaPuesta,
  vencido = false,
  onPromo,
  onVendido,
  onTirar,
}: {
  e: ExpiryRow;
  canEdit: boolean;
  pending: boolean;
  sugerencia?: SugerenciaPromo;
  yaPuesta?: number;
  vencido?: boolean;
  onPromo?: (s: SugerenciaPromo) => void;
  onVendido: () => void;
  onTirar: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const u = urgencia(e.daysLeft);
  const bajoCosto =
    sugerencia != null &&
    sugerencia.cost !== null &&
    Number(sugerencia.sugerido) < Number(sugerencia.cost);

  return (
    /* MOBILE APILA, DESKTOP EN LANES. Las cinco lanes no entran a 390: la
       primera versión las metía en una sola línea y el nombre quedaba con ~10px
       de ancho, así que `overflow-wrap` lo partía UN CARÁCTER POR LÍNEA. El
       nombre necesita su propio renglón abajo de lg; `lg:contents` disuelve el
       envoltorio de la segunda línea para que en escritorio las lanes vuelvan a
       alinearse con las del encabezado. */
    <li className="flex flex-col gap-1.5 px-3 py-2.5 lg:flex-row lg:items-center lg:gap-3 lg:px-4">
      <div className="flex min-w-0 items-center gap-2.5 lg:flex-1 lg:gap-3">
        <span className="w-5 shrink-0 text-center text-base" aria-hidden>
          {e.productEmoji ?? "📦"}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm">{e.productName}</span>
      </div>

      {/* `flex-wrap` en mobile: si la acción no entra, BAJA en vez de recortarse.
          Antes el botón de promo quedaba cortado contra el borde derecho, o sea
          que el precio sugerido —el dato que hace que el tap valga la pena— se
          leía a medias. Envolver cuesta una línea sólo cuando hace falta;
          recortar cuesta el dato siempre. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pl-7 lg:contents lg:pl-0">
      <span className="tabular w-12 shrink-0 text-right text-xs text-muted-foreground">
        {e.qty} u.
      </span>

      {/* EL PROTAGONISTA. Único máximo de contraste de la fila. */}
      <span className="tabular w-24 shrink-0 text-right text-sm font-semibold text-foreground">
        {money(e.valorVenta)}
      </span>

      <span
        className={cn(
          /* `w-44` y no `w-36`: medido, "mar 11 · venció hace 9 d." necesita
             131px y la lane daba 128 — se cortaba por TRES píxeles, y con el
             día de dos dígitos el "d." final desaparecía. Se dimensiona para el
             peor caso y no para los datos de hoy: `days_left` no tiene cota
             inferior (la consulta sólo topea a 180 días HACIA ADELANTE), así
             que "venció hace 365 d." es posible y tiene que entrar.

             `w-48` y no `w-44`: con 44 el peor caso medido entraba EXACTO
             (150px de 150), o sea con cero margen — cualquier diferencia de
             render, zoom o fuente lo volvía a cortar. El nombre tiene ~576px a
             1152, así que los 16px extra no le hacen falta a nadie más. */
          "flex w-auto shrink-0 items-center gap-1 text-xs lg:w-48",
          u.tone === "danger" && "text-danger-ink",
          u.tone === "warning" && "text-warning-ink",
          u.tone === "muted" && "text-muted-foreground",
        )}
      >
        <Clock className="size-3 shrink-0" aria-hidden />
        {/* Fecha absoluta y urgencia relativa son el mismo dato en dos
            unidades: van juntas. Se fue la ISO cruda (`2026-08-08`) que
            convivía con `fechaCorta` tres píxeles más arriba. */}
        <span className="truncate">
          {fechaCorta(e.expiryDate)} · {u.label}
        </span>
      </span>

      {/* La acción. Sólo se dibuja si el permiso alcanza: antes se mostraba a
          todos y un empleado sin `can_receive_stock` recibía "no tenés permiso"
          DESPUÉS de tocar. */}
      {canEdit && (
        <div className="relative w-auto shrink-0 sm:w-40">
          {vencido ? (
            <div className="flex items-center justify-end gap-1">
              <button
                type="button"
                disabled={pending}
                onClick={onTirar}
                className="flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium transition-colors hover:border-danger hover:text-danger-ink disabled:opacity-40"
              >
                <Trash2 className="size-3.5" /> Tirarlo
              </button>
              <button
                type="button"
                aria-label={`Más acciones para ${e.productName}`}
                onClick={() => setAbierto((v) => !v)}
                className="grid size-8 cursor-pointer place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground"
              >
                <MoreHorizontal className="size-3.5" />
              </button>
              {abierto && (
                /* "Se vendió" sigue existiendo —el caso real es "lo vendí ayer y
                   no lo marqué"— pero deja de tener el mismo peso visual que la
                   acción correcta para un lote vencido. */
                <div className="absolute right-0 top-9 z-10 w-44 rounded-lg border border-border bg-popover p-1 shadow-lg">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      setAbierto(false);
                      onVendido();
                    }}
                    className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs transition-colors hover:bg-secondary disabled:opacity-40"
                  >
                    <Check className="size-3.5" /> Se vendió
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* POR VENCER: la primaria es la promo cuando hay sugerencia, y el
               resto vive en el overflow. El overflow NO es opcional acá — sin
               él, un lote con promo sugerida no tendría forma de registrar
               "se me rompió el paquete", que es exactamente el caso para el
               que existe la merma parcial. */
            <div className="flex items-center justify-end gap-1">
              {yaPuesta != null ? (
                <span className="tabular flex items-center gap-1.5 text-xs text-info-ink">
                  <Tag className="size-3.5 shrink-0" /> En promo {money(yaPuesta)}
                </span>
              ) : bajoCosto ? (
                <Link
                  href="/admin/promos"
                  className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  Bajo costo <ArrowRight className="size-3.5 shrink-0" />
                </Link>
              ) : sugerencia && onPromo ? (
                /* La franja de promo dejó de ser un bloque apilado arriba de la
                   fila: ahora ES la acción del grupo. Nadie tira algo que
                   todavía no venció. */
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => onPromo(sugerencia)}
                  className="tabular flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-info/40 px-2.5 text-xs font-medium text-info-ink transition-colors hover:bg-info/10 disabled:opacity-40"
                >
                  <Tag className="size-3.5 shrink-0" /> Promo {money(Number(sugerencia.sugerido))}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={pending}
                  onClick={onVendido}
                  className="flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium transition-colors hover:border-success disabled:opacity-40"
                >
                  <Check className="size-3.5" /> Se vendió
                </button>
              )}

              <button
                type="button"
                aria-label={`Más acciones para ${e.productName}`}
                onClick={() => setAbierto((v) => !v)}
                className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground"
              >
                <MoreHorizontal className="size-3.5" />
              </button>

              {abierto && (
                <div className="absolute right-0 top-9 z-10 w-48 rounded-lg border border-border bg-popover p-1 shadow-lg">
                  {sugerencia != null || yaPuesta != null ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        setAbierto(false);
                        onVendido();
                      }}
                      className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs transition-colors hover:bg-secondary disabled:opacity-40"
                    >
                      <Check className="size-3.5" /> Se vendió
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      setAbierto(false);
                      onTirar();
                    }}
                    className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-danger-ink transition-colors hover:bg-secondary disabled:opacity-40"
                  >
                    <Trash2 className="size-3.5" /> Tuve que tirarlo
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      </div>
    </li>
  );
}

/**
 * El grupo de vencidos: colapsado, pero declarando su COSTO EN DATOS.
 *
 * No es un chevron mudo. Un lote vencido sin resolver no es sólo papeleo: está
 * MINTIENDO sobre el stock — la app cree que tenés unidades que ya no existen,
 * y con eso decide reposición y promociones. Por eso el encabezado dice las
 * unidades fantasma, no sólo el conteo de lotes.
 *
 * Va colapsado y abajo porque el trabajo que CREA valor es el de arriba;
 * expandido empujaría lo accionable fuera de pantalla.
 */
function GrupoVencidos({
  items,
  unidades,
  valor,
  canEdit,
  pending,
  onVendido,
  onTirar,
}: {
  items: ExpiryRow[];
  unidades: number;
  valor: number;
  canEdit: boolean;
  pending: boolean;
  onVendido: (e: ExpiryRow) => void;
  onTirar: (e: ExpiryRow) => void;
}) {
  /* Arranca abierto si son pocos: colapsar 2 ítems es esconder trabajo que
     entra en pantalla. Con 6+ el default es cerrado. */
  const [abierto, setAbierto] = useState(items.length <= 5);

  return (
    <section className="overflow-hidden rounded-xl border border-danger/30 bg-danger/[0.05]">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className="flex w-full cursor-pointer items-center gap-3 px-3 py-3 text-left lg:px-4"
      >
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform duration-150",
            !abierto && "-rotate-90",
          )}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-danger-ink">
            {items.length} {items.length === 1 ? "lote vencido" : "lotes vencidos"} sin resolver
          </p>
          {/* EL COSTO EN DATOS, dicho con todas las letras. */}
          <p className="tabular text-xs text-muted-foreground">
            tu stock dice {unidades} u. que ya no tenés · {money(valor)} en venta
          </p>
        </div>
      </button>

      {abierto && (
        <ul className="divide-y divide-danger/15 border-t border-danger/20">
          {items.map((e) => (
            <Fila
              key={e.id}
              e={e}
              canEdit={canEdit}
              pending={pending}
              vencido
              onVendido={() => onVendido(e)}
              onTirar={() => onTirar(e)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * La confirmación de merma — con cantidad editable.
 *
 * NO ES "¿estás seguro?": es la cifra y la cantidad. Y el parcial no es un
 * lujo: vencen 6, se vendieron 4 y tiraste 2. Sin él, el dueño elige entre dos
 * datos FALSOS — "se vendió" (la pérdida nunca se registra y el motor de promos
 * decide con datos inflados) o "tiré 6" (el stock queda 4 corto y la app avisa
 * faltante de algo que está en la góndola).
 *
 * Confirmar un número falso es PEOR que escribirlo sin confirmar, porque queda
 * con aspecto de revisado. Por eso la confirmación y el parcial van juntos.
 *
 * No hay "deshacer": `stock_ledger` es append-only (`001:538` revoca update y
 * delete), así que deshacer significaría un asiento compensatorio que ensucia
 * el reporte de mermas para siempre. La irreversibilidad no es una elección de
 * UX — está en el grant. Por eso se previene en vez de compensar.
 */
function DialogoMerma({
  e,
  pending,
  onCancelar,
  onConfirmar,
}: {
  e: ExpiryRow;
  pending: boolean;
  onCancelar: () => void;
  onConfirmar: (qty: number) => void;
}) {
  const [qty, setQty] = useState(String(e.qty));
  const n = Number(qty);
  const valido = Number.isFinite(n) && n > 0 && n <= e.qty;
  const parcial = valido && n < e.qty;
  const vencido = e.daysLeft < 0;
  /* Proporcional: es el valor EN VENTA de lo que se tira, no el costo. */
  const valor = valido ? (e.valorVenta / e.qty) * n : 0;

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/60 sm:place-items-center sm:p-4">
      <div className="max-h-[85dvh] w-full overflow-y-auto rounded-t-2xl border border-border bg-popover p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:max-w-sm sm:rounded-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Tirar {e.productName}</h2>
          <button
            type="button"
            onClick={onCancelar}
            aria-label="Cerrar"
            className="cursor-pointer text-muted-foreground hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>

        <label htmlFor="merma-qty" className="block text-sm font-medium">
          ¿Cuántas tirás?
        </label>
        <div className="mt-1.5 flex items-center gap-2">
          <input
            id="merma-qty"
            value={qty}
            inputMode="numeric"
            onChange={(ev) => setQty(ev.target.value.replace(/[^\d]/g, ""))}
            className="tabular h-11 w-24 rounded-lg border border-input bg-card px-3 text-sm outline-none focus:border-primary"
          />
          <span className="text-sm text-muted-foreground">de {e.qty} u.</span>
          <button
            type="button"
            onClick={() => setQty(String(e.qty))}
            className="ml-auto cursor-pointer text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            todas
          </button>
        </div>

        {!valido && qty !== "" && (
          <p className="mt-2 text-xs text-danger-ink">
            Tiene que ser entre 1 y {e.qty}.
          </p>
        )}

        {parcial && (
          <p className="mt-3 rounded-lg border border-border bg-secondary px-3 py-2 text-xs text-muted-foreground">
            {vencido
              ? `Las otras ${e.qty - n} u. quedan como vendidas y el lote se cierra.`
              : `Las otras ${e.qty - n} u. siguen pendientes con su fecha.`}
          </p>
        )}

        <p className="mt-3 text-sm">
          Se registra como pérdida y baja el stock.{" "}
          <span className="text-muted-foreground">No se puede deshacer.</span>
        </p>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onCancelar}
            className="h-11 flex-1 cursor-pointer rounded-lg border border-border text-sm"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={pending || !valido}
            onClick={() => onConfirmar(n)}
            /* El botón NOMBRA la acción y su monto, no dice "Aceptar". */
            className="tabular flex h-11 flex-[2] cursor-pointer items-center justify-center gap-2 rounded-lg bg-danger text-sm font-semibold text-danger-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {pending && <LoaderCircle className="size-4 animate-spin" />}
            Tirar {valido ? n : 0} u. · {money(valor)}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Cargar un vencimiento — con el producto en la mano.
 *
 * El `<select>` de 501 opciones se fue entero (ver `buscador-producto.tsx`).
 * La hoja NO se cierra entre ítems: "Guardar y cargar otro" recicla el
 * formulario, porque en la góndola se cargan varios seguidos y reabrir la hoja
 * por cada uno es el grueso del tiempo perdido.
 */
function AddExpiryDialog({
  onClose,
  onDone,
  onError,
}: {
  onClose: () => void;
  onDone: () => void;
  onError: (text: string) => void;
}) {
  const [prod, setProd] = useState<IngresoBuscado | null>(null);
  const [fecha, setFecha] = useState("");
  const [qty, setQty] = useState("");
  const [cargados, setCargados] = useState(0);
  const [pending, startTransition] = useTransition();

  function guardar(seguir: boolean) {
    if (!prod || !fecha || !qty) return;
    startTransition(async () => {
      const r = await addExpiry({ productId: prod.id, expiryDate: fecha, qty: Number(qty) });
      if (!r.ok) {
        onError(r.error);
        return;
      }
      if (seguir) {
        /* Se recicla la hoja: el producto y la fecha se limpian, el contador
           sube. Lo que NO se hace es cerrar y reabrir. */
        setCargados((c) => c + 1);
        setProd(null);
        setFecha("");
        setQty("");
        return;
      }
      onDone();
    });
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/60 sm:place-items-center sm:p-4">
      <div className="max-h-[85dvh] w-full overflow-y-auto rounded-t-2xl border border-border bg-popover p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:max-w-md sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold">
            Cargar vencimiento
            {cargados > 0 && (
              <span className="tabular ml-2 font-normal text-muted-foreground">
                {cargados} cargado{cargados === 1 ? "" : "s"}
              </span>
            )}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="cursor-pointer text-muted-foreground hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <span className="text-sm font-medium">¿Qué producto?</span>
            {prod ? (
              <div className="flex items-center gap-2.5 rounded-lg border border-border bg-secondary/60 px-3 py-2.5">
                <span className="w-5 shrink-0 text-center" aria-hidden>
                  {prod.emoji ?? "📦"}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm">{prod.name}</span>
                <button
                  type="button"
                  onClick={() => setProd(null)}
                  className="shrink-0 cursor-pointer text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                >
                  Cambiar
                </button>
              </div>
            ) : (
              <BuscadorProducto autoFocus onElegir={setProd} />
            )}
          </div>

          <div className="flex gap-2">
            <div className="flex-1 space-y-1.5">
              <label htmlFor="ae-fecha" className="text-sm font-medium">
                ¿Cuándo vence?
              </label>
              <input
                id="ae-fecha"
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="h-11 w-full rounded-lg border border-input bg-background px-2 text-sm outline-none focus:border-primary"
              />
            </div>
            <div className="w-28 space-y-1.5">
              <label htmlFor="ae-qty" className="text-sm font-medium">
                ¿Cuántas?
              </label>
              <input
                id="ae-qty"
                value={qty}
                onChange={(e) => setQty(e.target.value.replace(/[^\d]/g, ""))}
                inputMode="numeric"
                placeholder="6"
                className="tabular h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => guardar(true)}
              disabled={pending || !prod || !fecha || !qty}
              className="flex h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {pending && <LoaderCircle className="size-4 animate-spin" />}
              Guardar y cargar otro
            </button>
            <button
              type="button"
              onClick={() => guardar(false)}
              disabled={pending || !prod || !fecha || !qty}
              className="h-11 shrink-0 cursor-pointer rounded-lg border border-border px-4 text-sm disabled:opacity-40"
            >
              Listo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Activación de los avisos al teléfono. */
function PushCard({
  vapidPublicKey,
  onAviso,
}: {
  vapidPublicKey: string | null;
  onAviso: (a: Aviso) => void;
}) {
  const [estado, setEstado] = useState<"cargando" | "no-soportado" | "off" | "on">("cargando");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !vapidPublicKey) {
        setEstado("no-soportado");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      const sub = await reg.pushManager.getSubscription();

      if (!sub) {
        setEstado("off");
        return;
      }

      /* AUTO-REPARACIÓN. El navegador puede tener una suscripción que nuestra
         base no tiene (se perdió la fila, se cambió de negocio, se restauró un
         backup). Si solo miráramos el navegador, la pantalla diría "activos" y
         no llegaría nada NUNCA, sin forma de re-activar: el botón no aparece.
         Al reenviarla en cada carga, ambos lados quedan sincronizados. El upsert
         es por endpoint, así que repetirlo no duplica. */
      const json = sub.toJSON() as {
        endpoint?: string;
        keys?: { p256dh: string; auth: string };
      };
      const res = await subscribeToPush({
        endpoint: json.endpoint,
        p256dh: json.keys?.p256dh,
        auth: json.keys?.auth,
      });
      setEstado(res.ok ? "on" : "off");
    })().catch(() => setEstado("no-soportado"));
  }, [vapidPublicKey]);

  function activar() {
    if (!vapidPublicKey) return;
    startTransition(async () => {
      try {
        const permiso = await Notification.requestPermission();
        if (permiso !== "granted") {
          onAviso({ tone: "error", text: "Necesitamos permiso para avisarte." });
          return;
        }
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
        const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh: string; auth: string } };
        const res = await subscribeToPush({
          endpoint: json.endpoint,
          p256dh: json.keys?.p256dh,
          auth: json.keys?.auth,
        });
        if (!res.ok) {
          onAviso({ tone: "error", text: res.error });
          return;
        }
        setEstado("on");
        // El resultado de la prueba SÍ se muestra: antes se ignoraba y el usuario
        // quedaba con "activado" sin que le llegara nunca nada.
        const prueba = await sendTestPush();
        onAviso(
          prueba.ok
            ? { tone: "ok", text: "Listo. Te mandamos un aviso de prueba al teléfono." }
            : { tone: "error", text: prueba.error },
        );
      } catch {
        onAviso({ tone: "error", text: "No pudimos activar los avisos en este dispositivo." });
      }
    });
  }

  if (estado === "cargando") return null;

  if (estado === "no-soportado") {
    return (
      <div className="mb-4 rounded-xl border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">
          Este navegador no puede recibir avisos. Instalá StockFlow desde el teléfono para
          que te lleguen.
        </p>
      </div>
    );
  }

  return (
    <div className="mb-4 flex items-start gap-3 rounded-xl border border-border bg-card p-4">
      <div
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-lg",
          estado === "on" ? "bg-success/15 text-success-ink" : "bg-accent text-accent-foreground",
        )}
      >
        {estado === "on" ? <BellRing className="size-5" /> : <Bell className="size-5" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">
          {estado === "on" ? "Los avisos están activos" : "Que el sistema te avise solo"}
        </p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {estado === "on"
            ? "Te avisamos al teléfono cuando algo esté por vencer o te estés quedando sin stock."
            : "Activá las notificaciones y te avisamos antes de que pierdas plata."}
        </p>
      </div>
      {estado === "off" ? (
        <button
          type="button"
          onClick={activar}
          disabled={pending}
          className="flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending && <LoaderCircle className="size-3.5 animate-spin" />}
          Activar
        </button>
      ) : (
        /* Poder reenviar el aviso sin desactivar y volver a activar: es lo
           primero que uno quiere hacer cuando duda de si llegan. */
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const r = await sendTestPush();
              onAviso(
                r.ok
                  ? { tone: "ok", text: "Aviso enviado. Fijate en el teléfono." }
                  : { tone: "error", text: r.error },
              );
            })
          }
          className="flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium transition-colors hover:border-primary disabled:opacity-50"
        >
          {pending && <LoaderCircle className="size-3.5 animate-spin" />}
          Probar
        </button>
      )}
    </div>
  );
}

/**
 * La clave VAPID viaja en base64url; PushManager la quiere como bytes.
 * El buffer se crea explícito para que el tipo sea `Uint8Array<ArrayBuffer>`:
 * desde TS 5.7 `Uint8Array` es genérico sobre su buffer y `applicationServerKey`
 * no acepta uno que pudiera ser `SharedArrayBuffer`.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; ++i) output[i] = raw.charCodeAt(i);
  return output;
}
