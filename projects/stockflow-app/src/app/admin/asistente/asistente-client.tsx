"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  RefreshCw,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Tag,
  PackageX,
  Users,
  Database,
  CircleDollarSign,
  Barcode,
  FolderTree,
  PackageSearch,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { money } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import type { Analisis, Accion, TipoAccion } from "@/lib/asistente/analisis";
import { rutaOportunidad } from "@/lib/asistente/enlaces";
import { actualizarAnalisis } from "./actions";

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
const PENDIENTES_DEF: {
  clave: keyof Omit<Pendientes, "total_activos">;
  icono: LucideIcon;
  titulo: (n: number) => string;
  porque: string;
  href: string;
}[] = [
  {
    clave: "sin_costo",
    icono: CircleDollarSign,
    titulo: (n) => `${n} ${n === 1 ? "producto" : "productos"} sin costo cargado`,
    porque: "Sin el costo no sabés cuánto ganás con ellos, y el análisis no puede recomendarte precio.",
    href: "/admin/productos",
  },
  {
    clave: "sin_codigo",
    icono: Barcode,
    titulo: (n) => `${n} ${n === 1 ? "producto" : "productos"} sin código de barras`,
    porque: "No se pueden escanear en el POS: cada venta los busca a mano.",
    href: "/admin/productos",
  },
  {
    clave: "sin_categoria",
    icono: FolderTree,
    titulo: (n) => `${n} ${n === 1 ? "producto" : "productos"} sin categoría`,
    porque: "Quedan afuera de los reportes por rubro y del índice de Productos.",
    href: "/admin/productos",
  },
  {
    clave: "stock_sin_confirmar",
    icono: PackageSearch,
    titulo: (n) => `${n} ${n === 1 ? "producto" : "productos"} con stock sin confirmar`,
    porque: "Quedaron marcados para revisar desde la puesta en marcha.",
    href: "/admin/productos",
  },
];

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

const ICONO_ACCION: Record<TipoAccion, LucideIcon> = {
  remarcar: Tag,
  stock_muerto: PackageX,
  fiado: Users,
  datos: Database,
};

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
      <h3 className="text-base font-semibold leading-snug">{a.dolor.titulo}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{a.dolor.porque}</p>

      <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Qué hacer esta semana
      </p>
      <ul className="mt-2 space-y-2">
        {a.acciones.map((acc, i) => {
          const destino = destinoDeAccion(acc, desde);
          const Icono = ICONO_ACCION[acc.tipo];
          return (
            <li
              key={i}
              className="flex flex-col gap-2 rounded-lg border border-border bg-secondary/40 px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="flex min-w-0 items-start gap-2.5 text-sm leading-relaxed">
                <Icono className="mt-0.5 size-4 shrink-0 text-primary-ink" />
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
        <p className="mt-4 border-t border-border pt-3 text-sm leading-relaxed text-muted-foreground">
          {a.fuga}
        </p>
      )}
      {a.huecos && (
        <p className="mt-3 rounded-lg border border-warning/25 bg-warning/10 px-3.5 py-2.5 text-sm leading-relaxed text-warning-ink">
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
  const items = PENDIENTES_DEF.filter((d) => (pendientes?.[d.clave] ?? 0) > 0);

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
    <div className="mx-auto max-w-3xl px-4 py-6 lg:px-8 lg:py-8">
      <div className="mb-5">
        <PageHeader
          title="Asistente"
          subtitle={
            items.length === 0
              ? "Tu catálogo está al día."
              : `${items.length} ${items.length === 1 ? "cosa pendiente" : "cosas pendientes"} en tu catálogo`
          }
          icon={Sparkles}
        />
      </div>

      {/* ── Pendientes: lo accionable, primero ─────────────────────────────── */}
      {items.length === 0 ? (
        <div className="rounded-xl border border-border bg-card px-5 py-6 text-center">
          <CheckCircle2 className="mx-auto size-7 text-success" />
          <p className="mt-2 text-sm font-medium">Nada pendiente en el catálogo</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Todos tus productos tienen costo, código, categoría y stock confirmado.
          </p>
        </div>
      ) : (
        <ul className="overflow-hidden rounded-xl border border-border bg-card">
          {items.map((d, i) => {
            const n = pendientes?.[d.clave] ?? 0;
            return (
              <li key={d.clave} className={cn(i > 0 && "border-t border-border")}>
                <Link
                  href={d.href}
                  className="flex cursor-pointer items-center gap-3.5 px-4 py-3.5 transition-colors hover:bg-secondary"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent">
                    <d.icono className="size-4.5 text-accent-foreground" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{d.titulo(n)}</span>
                    <span className="block text-xs leading-relaxed text-muted-foreground">
                      {d.porque}
                    </span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {/* ── El análisis del mes, relegado: es lo que ya llega por mail ─────── */}
      {activo && (
        <section className="mt-6">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setVerAnalisis(!verAnalisis)}
              className="flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
            >
              <ChevronDown className={cn("size-3.5 transition-transform", !verAnalisis && "-rotate-90")} />
              Análisis del mes
              {ultimo && <span className="font-normal normal-case tracking-normal">· {fecha(ultimo.created_at)}</span>}
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
                <div className="rounded-xl border border-border bg-card px-5 py-6 text-center text-sm text-muted-foreground">
                  Todavía no hay ningún análisis. Generá el primero con “Actualizar”.
                </div>
              ) : (
                <>
                  <div className="rounded-xl border border-border bg-card px-5 py-5">
                    <p className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="rounded-full bg-accent px-2 py-0.5 font-medium text-accent-foreground">
                        {ORIGEN_LABEL[ultimo.origen]}
                      </span>
                      {fecha(ultimo.created_at)}
                    </p>
                    <CuerpoAnalisis a={ultimo.analisis} desde={ultimo.period_from} />
                  </div>

                  {anteriores.length > 0 && (
                    <ul className="mt-3 overflow-hidden rounded-xl border border-border bg-card">
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
                              <div className="border-t border-border px-4 py-4">
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
