import { cn } from "@/lib/cn";

/**
 * Ilustración de empty state: el "objeto de vidrio negro con aristas azules"
 * de la familia del isotipo, una por pantalla. Reemplaza al ícono lucide chico
 * en los estados vacíos para que la primera pantalla sin datos no se sienta rota
 * sino diseñada.
 *
 * Los WebP viven en `public/empty/` (512², generados con la dirección de arte de
 * la marca). Tamaño fijo (size-28 = 112px) con width/height explícitos → CLS 0.
 * `alt` corto y con sentido: describe el objeto, no "ilustración de…".
 */
export type EmptyArtName =
  | "productos"
  | "recibir"
  | "fiado"
  | "vencimientos"
  | "reportes"
  | "equipo"
  | "precios";

export function EmptyArt({
  name,
  alt,
  className,
}: {
  name: EmptyArtName;
  alt: string;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- asset estático local, sin optimización de next/image necesaria
    <img
      src={`/empty/${name}.webp`}
      alt={alt}
      width={112}
      height={112}
      loading="lazy"
      draggable={false}
      className={cn("mx-auto mb-4 size-28 select-none", className)}
    />
  );
}
