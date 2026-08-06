"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  RefreshCw,
  AlertTriangle,
  ChevronDown,
  Tag,
  PackageX,
  Users,
  Database,
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
  activo,
  turnoDeHoyUsado,
}: {
  analisis: AnalisisGuardado[];
  activo: boolean;
  turnoDeHoyUsado: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);

  const [ultimo, ...anteriores] = analisis;

  const actualizar = () => {
    setError(null);
    startTransition(async () => {
      const r = await actualizarAnalisis();
      if (!r.ok) setError(r.error);
      else router.refresh();
    });
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 lg:px-8 lg:py-8">
      <div className="mb-5">
        <PageHeader
          title="Asistente"
          subtitle={
            ultimo
              ? `Último análisis: ${fecha(ultimo.created_at)}`
              : "El diagnóstico de tu negocio, con números verificados."
          }
          icon={Sparkles}
        >
          {activo && (
            <button
              type="button"
              onClick={actualizar}
              disabled={pending || turnoDeHoyUsado}
              title={turnoDeHoyUsado ? "Ya actualizaste hoy — mañana podés generar otro" : undefined}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-medium transition-colors",
                pending || turnoDeHoyUsado
                  ? "cursor-default opacity-50"
                  : "hover:border-primary/40 hover:text-primary-ink",
              )}
            >
              <RefreshCw className={cn("size-4", pending && "animate-spin")} />
              {pending ? "Analizando tu negocio…" : turnoDeHoyUsado ? "Actualizado hoy" : "Actualizar análisis"}
            </button>
          )}
        </PageHeader>
      </div>

      {error && (
        <p className="mb-4 flex items-start gap-2 rounded-lg border border-danger/25 bg-danger/10 px-3.5 py-2.5 text-sm text-danger-ink">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}

      {!activo ? (
        /* El add-on apagado no esconde la página: muestra qué se está perdiendo. */
        <div className="rounded-xl border border-border bg-card px-5 py-8 text-center">
          <Sparkles className="mx-auto size-8 text-muted-foreground" />
          <h2 className="mt-3 text-base font-semibold">El asistente no está activo en tu plan</h2>
          <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground">
            Con el asistente activo, cada mes recibís un diagnóstico de dónde se te está yendo la
            plata — precios que quedaron viejos, stock parado, fiado sin cobrar — con los números de
            tu negocio y la inflación real de tu rubro según INDEC.
          </p>
        </div>
      ) : !ultimo ? (
        <div className="rounded-xl border border-border bg-card px-5 py-8 text-center">
          <Sparkles className="mx-auto size-8 text-muted-foreground" />
          <h2 className="mt-3 text-base font-semibold">Todavía no hay ningún análisis</h2>
          <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground">
            Generá el primero: el asistente mira tus precios, tu stock parado, tu fiado y la
            inflación de tu rubro, y te dice qué hacer esta semana.
          </p>
        </div>
      ) : (
        <>
          <section className="rounded-xl border border-border bg-card px-5 py-5">
            <p className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="rounded-full bg-accent px-2 py-0.5 font-medium text-accent-foreground">
                {ORIGEN_LABEL[ultimo.origen]}
              </span>
              {fecha(ultimo.created_at)}
            </p>
            <CuerpoAnalisis a={ultimo.analisis} desde={ultimo.period_from} />
          </section>

          {anteriores.length > 0 && (
            <section className="mt-6">
              <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Análisis anteriores
              </h2>
              <ul className="overflow-hidden rounded-xl border border-border bg-card">
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
            </section>
          )}
        </>
      )}
    </div>
  );
}
