"use client";

import { useState, useTransition, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  RefreshCw,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Barcode,
  FolderTree,
  PackageSearch,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { money } from "@/lib/format";
import { PageHeader, HeaderStat } from "@/components/ui/page-header";
import { CardHero } from "@/components/ui/card-system";
import { CountUp } from "@/components/ui/count-up";
import { EmptyArt } from "@/components/ui/empty-art";
import type { Analisis, Accion, TipoAccion } from "@/lib/asistente/analisis";
import { rutaOportunidad } from "@/lib/asistente/enlaces";
import { actualizarAnalisis } from "./actions";
import { TareasCatalogo } from "./tareas-catalogo";

export type AnalisisGuardado = {
  id: string;
  origen: "mensual" | "semanal" | "manual";
  period_from: string;
  period_to: string;
  analisis: Analisis;
  created_at: string;
};

export type Pendientes = {
  sin_costo: number;
  sin_categoria: number;
  sin_codigo: number;
  stock_sin_confirmar: number;
  total_activos: number;
};

/* ── Pendientes: la deuda administrativa que ninguna otra pantalla junta ────────
   El criterio (feedback del owner): NO repetir lo que ya muestra otra sección.
   Stock bajo y vencimientos viven en Resumen; los precios erosionados en
   Precios. Esto es lo que quedó a medio cargar y degrada todo en silencio. */
/**
 * Cada pendiente viste un color con historia (spec design-director 2026-08-06):
 * dos sistemas que la app YA tiene, en capas. Ámbar (léxico de estado: cuidado)
 * SOLO para la deuda que es riesgo activo — sin costo podés estar vendiendo a
 * pérdida sin saberlo. Las otras tres visten el hue del grupo de la nav donde
 * DUELEN: sin código pega en el POS (Operación azul), sin categoría en reportes
 * e índice (Control terracota), stock sin confirmar es deuda de setup (Negocio
 * acero). La identidad viaja con el TIPO; el volumen (glow/barra) con el PUESTO.
 */
const PENDIENTES_DEF: {
  clave: keyof Omit<Pendientes, "total_activos">;
  icono: LucideIcon;
  /** Color de identidad: número, chip, ring y hover. Clases estáticas (JIT). */
  num: string;
  ring: string;
  hover: string;
  /** El color crudo para los efectos que se calculan (chip bg, glow). */
  hex: string;
  barSolida: string;
  barMuted: string;
  /* El texto que sigue al número, que ahora es el protagonista del tile: la
     frase completa ("250 productos sin costo cargado") no cambió, se partió. */
  unidad: (n: number) => string;
  porque: string;
  href: string;
}[] = [
  {
    clave: "sin_costo",
    icono: CircleDollarSign,
    num: "text-warning-ink",
    ring: "ring-warning/25",
    hover: "hover:border-warning/35",
    hex: "#fbbf24",
    barSolida: "bg-warning",
    barMuted: "bg-warning/60",
    unidad: (n) => `${n === 1 ? "producto" : "productos"} sin costo cargado`,
    porque: "Sin el costo no sabés cuánto ganás con ellos, y el análisis no puede recomendarte precio.",
    href: "/admin/productos",
  },
  {
    clave: "sin_codigo",
    icono: Barcode,
    num: "text-[#6d9bff]",
    ring: "ring-[#6d9bff]/25",
    hover: "hover:border-[#6d9bff]/35",
    hex: "#6d9bff",
    barSolida: "bg-[#6d9bff]",
    barMuted: "bg-[#6d9bff]/60",
    unidad: (n) => `${n === 1 ? "producto" : "productos"} sin código de barras`,
    porque: "No se pueden escanear en el POS: cada venta los busca a mano.",
    href: "/admin/productos",
  },
  {
    clave: "sin_categoria",
    icono: FolderTree,
    num: "text-[#ec8d6f]",
    ring: "ring-[#ec8d6f]/25",
    hover: "hover:border-[#ec8d6f]/35",
    hex: "#ec8d6f",
    barSolida: "bg-[#ec8d6f]",
    barMuted: "bg-[#ec8d6f]/60",
    unidad: (n) => `${n === 1 ? "producto" : "productos"} sin categoría`,
    porque: "Quedan afuera de los reportes por rubro y del índice de Productos.",
    href: "/admin/productos",
  },
  {
    clave: "stock_sin_confirmar",
    icono: PackageSearch,
    num: "text-[#7c92b8]",
    ring: "ring-[#7c92b8]/25",
    hover: "hover:border-[#7c92b8]/35",
    hex: "#7c92b8",
    barSolida: "bg-[#7c92b8]",
    /* A /60 el acero queda 2,7:1 contra el track; a /70 pasa el 3:1 gráfico. */
    barMuted: "bg-[#7c92b8]/70",
    unidad: (n) => `${n === 1 ? "producto" : "productos"} con stock sin confirmar`,
    porque: "Quedaron marcados para revisar desde la puesta en marcha.",
    href: "/admin/productos",
  },
];

/* Los cuatro pendientes se resuelven en la misma pantalla, así que el pie del
   tile es uno solo — si algún día un pendiente vive en otro lado, pasa a ser
   un campo de la definición de arriba. */
const CTA_PENDIENTE = "Resolver en Productos";

/* Terracota del grupo "Control" de la nav (`nav-data`): el análisis es MIRAR el
   negocio, no una alerta. Va inline porque el hue no es un token de tema. */
const TERRACOTA = "#ec8d6f";
const CHIP_TERRACOTA: CSSProperties = {
  color: TERRACOTA,
  background: `color-mix(in srgb, ${TERRACOTA} 12%, transparent)`,
};

const nro = (n: number) => n.toLocaleString("es-AR");

/* Cada acción del análisis lleva a LA pantalla donde se resuelve — el mismo
   mapa que usan los botones del email, más "datos" que solo existe acá. */
function destinoDeAccion(a: Accion, desde: string): { href: string; label: string } {
  if (a.tipo === "datos") return { href: "/admin/productos", label: "Ir a Productos" };
  const LABEL: Record<Exclude<TipoAccion, "datos">, string> = {
    remarcar: "Ir a Precios",
    stock_muerto: "Ver stock parado",
    fiado: "Ir a Fiado",
  };
  return { href: rutaOportunidad(a.tipo, { desde }), label: LABEL[a.tipo] };
}

const ORIGEN_LABEL: Record<AnalisisGuardado["origen"], string> = {
  mensual: "Reporte mensual",
  semanal: "Actualización semanal",
  manual: "Actualización manual",
};

function fecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "long" });
}

/** El cuerpo de un análisis: dolor → acciones con su botón → fuga → huecos. */
function CuerpoAnalisis({ a, desde }: { a: Analisis; desde: string }) {
  return (
    <div>
      <h3 className="text-lg font-semibold leading-snug tracking-tight">{a.dolor.titulo}</h3>
      <p className="mt-1.5 max-w-[70ch] text-sm leading-relaxed text-muted-foreground">{a.dolor.porque}</p>

      <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Qué hacer esta semana
      </p>
      <ul className="mt-2 space-y-2">
        {a.acciones.map((acc, i) => {
          const destino = destinoDeAccion(acc, desde);
          return (
            <li
              key={i}
              className="flex flex-col gap-2 rounded-lg border border-transparent bg-secondary/40 px-3.5 py-3 transition-[border-color] duration-150 hover:border-primary/40 sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="flex min-w-0 items-start gap-2.5 text-sm leading-relaxed">
                {/* Número y no ícono: el orden ES la información (qué hago
                    primero). Un chip con las dos cosas quedaba cargado. */}
                <span
                  aria-hidden
                  className="tabular mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-semibold"
                  style={CHIP_TERRACOTA}
                >
                  {i + 1}
                </span>
                <span>
                  {acc.texto}
                  {acc.monto != null && (
                    <span className="ml-1.5 whitespace-nowrap font-semibold text-primary-ink">
                      {money(acc.monto)}
                    </span>
                  )}
                </span>
              </span>
              <Link
                href={destino.href}
                className="shrink-0 self-start rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium transition-colors hover:border-primary/40 hover:text-primary-ink sm:self-center"
              >
                {destino.label} →
              </Link>
            </li>
          );
        })}
      </ul>

      {a.fuga && (
        <p className="mt-4 max-w-[70ch] border-t border-border pt-3 text-sm leading-relaxed text-muted-foreground">
          {a.fuga}
        </p>
      )}
      {a.huecos && (
        <p className="mt-3 max-w-[70ch] rounded-lg border border-warning/25 bg-warning/10 px-3.5 py-2.5 text-sm leading-relaxed text-warning-ink">
          {a.huecos}
        </p>
      )}
    </div>
  );
}

export function AsistenteClient({
  analisis,
  pendientes,
  activo,
  turnoDeHoyUsado,
}: {
  analisis: AnalisisGuardado[];
  pendientes: Pendientes | null;
  activo: boolean;
  turnoDeHoyUsado: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [verAnalisis, setVerAnalisis] = useState(false);

  const [ultimo, ...anteriores] = analisis;
  /* De mayor a menor, y SOLO la más grande viste ámbar: cuatro tiles gritando
     al mismo tiempo no jerarquizan nada (feedback del owner). El ámbar vuelve a
     significar "esto primero"; el resto habla en neutro. */
  const items = PENDIENTES_DEF.filter((d) => (pendientes?.[d.clave] ?? 0) > 0).sort(
    (a, b) => (pendientes?.[b.clave] ?? 0) - (pendientes?.[a.clave] ?? 0),
  );
  /* Deriva de la misma definición que pinta los tiles: si mañana se suma un
     pendiente, el número de la banda se entera solo. */
  const totalPendientes = PENDIENTES_DEF.reduce((a, d) => a + (pendientes?.[d.clave] ?? 0), 0);
  const activos = pendientes?.total_activos ?? 0;

  const actualizar = () => {
    setError(null);
    startTransition(async () => {
      const r = await actualizarAnalisis();
      if (!r.ok) setError(r.error);
      else {
        setVerAnalisis(true);
        router.refresh();
      }
    });
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8 lg:py-8">
      <div className="mb-5">
        <PageHeader
          title="Asistente"
          subtitle={
            items.length === 0
              ? "Tu catálogo está al día."
              : `${items.length} ${items.length === 1 ? "cosa pendiente" : "cosas pendientes"} en tu catálogo`
          }
          icon={Sparkles}
          art="reportes"
          stat={<HeaderStat value={nro(totalPendientes)} caption="datos por cargar" />}
        />
      </div>

      {/* ── Pendientes: lo accionable, primero ─────────────────────────────── */}
      {items.length === 0 ? (
        /* Superficie rica igual que los tiles, pero con el glow del acento: el
           verde queda SAGRADO para plata real (card-system), así que el tilde
           es verde y la luz de atrás no. */
        <CardHero glow="primary" className="p-6 text-center lg:p-6">
          <EmptyArt name="productos" alt="Una repisa vacía con un escáner" />
          <CheckCircle2 className="mx-auto size-7 text-success-ink" />
          <p className="mt-2 text-sm font-medium">Nada pendiente en el catálogo</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Todos tus productos tienen costo, código, categoría y stock confirmado.
          </p>
        </CardHero>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
          {items.map((d, i) => {
            const n = pendientes?.[d.clave] ?? 0;
            /* El puesto #1 habla más fuerte EN SU PROPIO color: glow 6% y barra
               sólida contra 4% y barra con alpha del resto. Identidad fija,
               volumen posicional — sobrevive a cualquier reordenamiento. */
            const primero = i === 0;
            /* La proporción es lo que convierte un número suelto en un juicio:
               250 sobre 300 es un catálogo roto, 250 sobre 4000 es una tarea. */
            const pct = activos > 0 ? Math.min(100, Math.round((n / activos) * 100)) : 0;
            return (
              <li key={d.clave}>
                <Link
                  href={d.href}
                  /* Mini-hero: el idioma de CardHero (gradiente + bevel + noise)
                     en un tile clickeable — no puede ser el componente porque
                     ese renderiza <section>. */
                  className={cn(
                    "bg-noise group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-xl border border-border p-4",
                    "bg-[linear-gradient(135deg,#182236_0%,#111621_60%)]",
                    "shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
                    "animate-in fade-in slide-in-from-bottom-2",
                    "transition-[transform,border-color] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5",
                    d.hover,
                  )}
                  /* La duración de la ENTRADA va inline: `duration-*` en Tailwind
                     v4 pisa transición y animación a la vez, y el hover tiene que
                     seguir siendo de 150ms mientras la cascada dura 500. */
                  style={{
                    animationDuration: "500ms",
                    animationDelay: `${i * 60}ms`,
                    animationFillMode: "backwards",
                  }}
                >
                  <span
                    aria-hidden
                    className="pointer-events-none absolute -left-4 -top-6 size-36 rounded-full opacity-70 blur-[40px] transition-opacity duration-200 group-hover:opacity-100"
                    style={{ background: `color-mix(in srgb, ${d.hex} ${primero ? 6 : 4}%, transparent)` }}
                  />
                  <span className="relative flex min-h-0 flex-1 flex-col">
    {/* Unidad SIEMPRE debajo del número: con la unidad al lado, los tiles
        de texto corto y largo quedaban asimétricos entre sí. */}
                    <span className="flex items-start justify-between gap-3">
                      <CountUp
                        value={n}
                        className={cn("tabular text-4xl font-bold tracking-tight", d.num)}
                      />
                      <span
                        className={cn("grid size-8 shrink-0 place-items-center rounded-lg ring-1", d.ring)}
                        style={{ color: d.hex === "#fbbf24" ? "var(--warning-ink)" : d.hex, background: `color-mix(in srgb, ${d.hex} 12%, transparent)` }}
                      >
                        <d.icono className="size-4" />
                      </span>
                    </span>
                    <span className="mt-0.5 block text-sm text-muted-foreground">{d.unidad(n)}</span>

                    {activos > 0 && (
                      <>
                        <span className="mt-3 block h-1 rounded-full bg-secondary">
                          <span
                            className={cn(
                              "block h-full rounded-full",
                              primero ? d.barSolida : d.barMuted,
                            )}
                            /* Piso de 2%: con catálogos grandes el fill real
                               redondea a 0 y la barra se veía rota. */
                            style={{ width: `${n > 0 ? Math.max(pct, 2) : 0}%` }}
                          />
                        </span>
                        <span className="tabular mt-1.5 block text-[11px] text-muted-foreground">
                          {nro(n)} de {nro(activos)} activos
                        </span>
                      </>
                    )}

                    <span className="mt-2 block text-xs leading-relaxed text-muted-foreground">
                      {d.porque}
                    </span>

                    <span className="mt-auto flex items-center gap-0.5 pt-3 text-xs font-medium text-primary-ink">
                      {CTA_PENDIENTE}
                      <ChevronRight className="size-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {/* Las tareas van DESPUÉS de los pendientes: primero qué falta, después
          qué puedo hacer yo al respecto. */}
      <TareasCatalogo onHecho={() => router.refresh()} />

      {/* ── El análisis del mes, relegado: es lo que ya llega por mail ─────── */}
      {activo && (
        <section className="mt-6">
          {/* La fila y el botón son HERMANOS a propósito: anidar el "Actualizar"
              dentro del disparador daría un <button> dentro de otro. */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setVerAnalisis(!verAnalisis)}
              aria-expanded={verAnalisis}
              className="flex min-w-0 flex-1 cursor-pointer items-center justify-between gap-3 rounded-xl border border-border bg-surface-1 px-4 py-3 text-left transition duration-150 hover:-translate-y-px hover:border-border-hover"
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <span
                  aria-hidden
                  className="grid size-8 shrink-0 place-items-center rounded-lg"
                  style={CHIP_TERRACOTA}
                >
                  <Sparkles className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">Análisis del mes</span>
                  {ultimo && (
                    <span className="block text-xs text-muted-foreground">
                      {fecha(ultimo.created_at)}
                    </span>
                  )}
                </span>
              </span>
              <ChevronDown
                className={cn(
                  "size-4 shrink-0 text-muted-foreground transition-transform",
                  !verAnalisis && "-rotate-90",
                )}
              />
            </button>
            <button
              type="button"
              onClick={actualizar}
              disabled={pending || turnoDeHoyUsado}
              title={turnoDeHoyUsado ? "Ya actualizaste hoy — mañana podés generar otro" : undefined}
              className={cn(
                "flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium transition-colors",
                pending || turnoDeHoyUsado
                  ? "cursor-default opacity-50"
                  : "hover:border-primary/40 hover:text-primary-ink",
              )}
            >
              <RefreshCw className={cn("size-3.5", pending && "animate-spin")} />
              {pending ? "Analizando…" : turnoDeHoyUsado ? "Actualizado hoy" : "Actualizar"}
            </button>
          </div>

          {error && (
            <p className="mt-3 flex items-start gap-2 rounded-lg border border-danger/25 bg-danger/10 px-3.5 py-2.5 text-sm text-danger-ink">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              {error}
            </p>
          )}

          {verAnalisis && (
            <div className="mt-3">
              {!ultimo ? (
                <div className="rounded-xl border border-border bg-card px-5 py-6 text-center text-sm text-muted-foreground duration-200 animate-in fade-in slide-in-from-top-1">
                  Todavía no hay ningún análisis. Generá el primero con “Actualizar”.
                </div>
              ) : (
                <>
                  {/* El análisis sube a superficie hero: es lectura larga, no una
                      fila de lista. Sin glow — no hay número que iluminar. */}
                  <CardHero className="p-5 lg:p-5">
                    <p className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span
                        className="rounded-full px-2 py-0.5 font-medium"
                        style={CHIP_TERRACOTA}
                      >
                        {ORIGEN_LABEL[ultimo.origen]}
                      </span>
                      {fecha(ultimo.created_at)}
                    </p>
                    <CuerpoAnalisis a={ultimo.analisis} desde={ultimo.period_from} />
                  </CardHero>

                  {anteriores.length > 0 && (
                    <ul className="mt-3 overflow-hidden rounded-xl border border-border bg-card duration-200 animate-in fade-in slide-in-from-top-1">
                      {anteriores.map((fila, i) => {
                        const expandido = abierto === fila.id;
                        return (
                          <li key={fila.id} className={cn(i > 0 && "border-t border-border")}>
                            <button
                              type="button"
                              onClick={() => setAbierto(expandido ? null : fila.id)}
                              className="flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary"
                            >
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-medium">
                                  {fila.analisis.dolor.titulo}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {ORIGEN_LABEL[fila.origen]} · {fecha(fila.created_at)}
                                </span>
                              </span>
                              <ChevronDown
                                className={cn(
                                  "size-4 shrink-0 text-muted-foreground transition-transform",
                                  expandido && "rotate-180",
                                )}
                              />
                            </button>
                            {expandido && (
                              <div className="border-t border-border px-4 py-4 duration-200 animate-in fade-in slide-in-from-top-1">
                                <CuerpoAnalisis a={fila.analisis} desde={fila.period_from} />
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
