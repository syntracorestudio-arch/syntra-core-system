import Image from "next/image";
import { cn } from "@/lib/cn";
import { artSrc, type BrandArt } from "@/lib/brand-art";

/**
 * Ilustración de empty state: el "objeto de vidrio negro con aristas azules"
 * de la familia del isotipo, una por pantalla. Reemplaza al ícono lucide chico
 * en los estados vacíos para que la primera pantalla sin datos no se sienta rota
 * sino diseñada.
 *
 * Los WebP viven en `public/art/` (512², generados con la dirección de arte de
 * la marca) y los comparte con el watermark de la banda de sección — ver
 * `@/lib/brand-art`. Tamaño fijo (size-28 = 112px) con width/height explícitos
 * → CLS 0. `alt` corto y con sentido: describe el objeto, no "ilustración de…".
 */
export function EmptyArt({
  name,
  alt,
  className,
}: {
  name: BrandArt;
  alt: string;
  className?: string;
}) {
  return (
    // next/image y no <img>: la fuente es de 512² y bajarla de golpe a 112px
    // con el remuestreo del navegador dejaba ver los artefactos del WebP.
    <Image
      src={artSrc(name)}
      alt={alt}
      width={112}
      height={112}
      sizes="112px"
      quality={90}
      loading="lazy"
      draggable={false}
      className={cn("mx-auto mb-4 size-28 select-none object-contain", className)}
    />
  );
}
