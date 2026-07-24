import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { artSrc, type BrandArt } from "@/lib/brand-art";

/**
 * Banda de sección — portada del patrón aprobado de StudioFlow (page-header v2),
 * ajustada al dark de StockFlow. Sin fotos a propósito (dirección 2026-07-22):
 * en una app operativa la foto compite con los números y rompe el white-label.
 * La identidad la dan el wash del acento, el WATERMARK del ícono de sección
 * (gigante, --primary a baja opacidad, sangrando abajo-derecha) y el hairline.
 *
 * `--accent` acá ya es azul-teñido (#16233c), así que el wash funciona directo
 * sobre dark sin overlay que gestionar: foreground sobre accent/card ≈ 14:1.
 *
 *  - icon: la Lucide de la sección (chip, y watermark de reserva).
 *  - art: el objeto 3D de la marca para el watermark (auditoría 2026-07-23).
 *    Va en `mix-blend-screen`, así que el vidrio negro desaparece contra el
 *    fondo y solo quedan las aristas encendidas: mucho más rico que el
 *    line-art plano, sin ensuciar ni tapar el título.
 *  - stat: dato contextual YA computado por la página (oculto en mobile).
 *  - children: acciones/filtros de la página (buscador, botones, chips).
 */
export function PageHeader({
  title,
  subtitle,
  icon: Icon,
  art,
  stat,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  art?: BrandArt;
  stat?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="relative overflow-hidden rounded-2xl border border-border px-5 py-4 duration-500 animate-in fade-in slide-in-from-bottom-2 sm:px-6 sm:py-5">
      <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-accent/60 via-card to-card" />
      {!art && Icon ? (
        <div aria-hidden className="absolute -bottom-8 -right-4 rotate-[-8deg] text-primary opacity-[0.08]">
          <Icon className="size-32 sm:size-36" strokeWidth={1.25} />
        </div>
      ) : null}
      <div aria-hidden className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-primary" />
      <div className="relative flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 items-center gap-3">
          {Icon ? (
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary-ink ring-1 ring-primary/25">
              <Icon className="size-4" aria-hidden />
            </span>
          ) : null}
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{title}</h1>
            {subtitle ? <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p> : null}
          </div>
        </div>
        {/* El objeto de marca va EN EL FLUJO, no absoluto: ocupa el hueco que
            queda entre el título y las acciones y se alinea contra ellas. Así
            entra entero en la banda (antes medía 192px dentro de 99px y se
            cortaba) y ningún botón lo tapa. */}
        {art ? (
          <div aria-hidden className="pointer-events-none flex flex-1 justify-end">
            {/* eslint-disable-next-line @next/next/no-img-element -- asset estático local */}
            <img
              src={artSrc(art)}
              alt=""
              width={512}
              height={512}
              loading="lazy"
              draggable={false}
              className="size-16 select-none opacity-70 mix-blend-screen sm:size-20"
            />
          </div>
        ) : null}
        {stat ? <div className="hidden shrink-0 text-right sm:block">{stat}</div> : null}
        {children ? <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">{children}</div> : null}
      </div>
    </header>
  );
}

/** Stat estándar de la banda: número protagonista + caption. */
export function HeaderStat({ value, caption }: { value: ReactNode; caption: string }) {
  return (
    <div>
      <p className="tabular text-xl font-bold tracking-tight text-foreground sm:text-2xl">{value}</p>
      <p className="text-xs text-muted-foreground">{caption}</p>
    </div>
  );
}
