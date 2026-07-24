import type { ReactNode } from "react";
import Image from "next/image";
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
 *  - art: el objeto 3D de la marca (auditoría 2026-07-23). Las piezas tienen
 *    transparencia real, así que se apoyan directo sobre el color de la card:
 *    no llevan `mix-blend-screen`, que era el parche para las que traían el
 *    fondo horneado y sobre una pieza recortada le apagaba el cuerpo oscuro.
 *  - artSize: cuánta presencia tiene ese objeto (ver abajo).
 *  - stat: dato contextual YA computado por la página (oculto en mobile).
 *  - children: acciones/filtros de la página (buscador, botones, chips).
 */
export function PageHeader({
  title,
  subtitle,
  icon: Icon,
  art,
  artSize = "md",
  stat,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  art?: BrandArt;
  /**
   * Presencia del objeto en la banda. Las piezas están todas encuadradas al
   * mismo 82% de su cuadro, así que el tamaño CSS es lo único que decide cuánto
   * pesa cada una. `lg` es para las bandas más altas —la portada del Resumen y
   * las secciones cuyo subtítulo pasa a dos líneas— donde la talla chica deja
   * al objeto perdido en el aire.
   */
  artSize?: "md" | "lg";
  stat?: ReactNode;
  children?: ReactNode;
}) {
  const grande = artSize === "lg";
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
        <div className="flex min-w-0 flex-1 items-center gap-3">
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
          <div aria-hidden className="pointer-events-none ml-auto flex shrink-0 justify-end">
            {/* Caja de tamaño fijo. `shrink-0` es obligatorio: como flex item,
                el shrink por defecto aplastaba el objeto a una tira (23x80 en
                Vencimientos, donde el subtítulo largo se come el hueco).
                El tamaño se elige por sección con `artSize` para que la
                proporción contra la banda quede pareja: las bandas cuyo
                subtítulo pasa a dos líneas son más altas y con la talla chica
                el objeto quedaba perdido (54% del alto). */}
            <div
              className={
                grande ? "size-32 shrink-0 sm:size-40" : "size-28 shrink-0 sm:size-32"
              }
            >
              {/* next/image y no <img>: la fuente es de 512² y el navegador la
                  bajaba de golpe a ~100px con un remuestreo pobre, así que los
                  artefactos del WebP se veían como dientes. Con `sizes` Next
                  sirve una variante ya escalada (y su 2x para pantallas de
                  densidad alta), remuestreada del lado del servidor. */}
              {/* `eager` y no `lazy`: la banda es lo primero de cada pantalla,
                  así que el objeto SIEMPRE cae sobre el pliegue y Next lo
                  detecta como elemento LCP. Diferirlo retrasaba justo la
                  métrica que la app tiene que cuidar. El de los estados vacíos
                  sí sigue perezoso: ese vive más abajo. */}
              <Image
                src={artSrc(art)}
                alt=""
                width={grande ? 160 : 128}
                height={grande ? 160 : 128}
                sizes={
                  grande
                    ? "(min-width: 640px) 160px, 128px"
                    : "(min-width: 640px) 128px, 112px"
                }
                quality={90}
                loading="eager"
                draggable={false}
                className="size-full select-none object-contain"
              />
            </div>
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
