import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * SHELL_ESCENARIO — la grilla ANCHA, reservada al acto de apertura: Navbar +
 * Hero. Es un rail deliberadamente distinto al de página (a 1920 arranca en
 * 256px contra 416px), no un descuido: el logo tiene que alinear con el H1 y
 * ambos se ven juntos en la primera pantalla. Además la cámara del vórtice
 * (`hero-anillos-3d.tsx`, setViewOffset) está anclada al viewport, así que
 * mover este shell descoloca la escena 3D aprobada.
 *
 * Vivía duplicado string-a-string en `navbar.tsx` y `hero-section.tsx`: dos
 * copias del mismo valor que nadie iba a mantener sincronizadas.
 */
const SHELL_ESCENARIO =
  "mx-auto w-full max-w-6xl px-6 lg:max-w-7xl lg:px-8 2xl:max-w-[94rem] 2xl:px-12";

/**
 * Container — ancho máximo controlado + padding responsive.
 * Mantiene la UI centrada y "respirando" (design-rules.md / ui-direction.md).
 *
 * px-6 (no px-5): el Hero, Casos y la Navbar usan su propia grilla con px-6.
 * Con px-5 las secciones que sí usan Container arrancaban 4px más a la
 * izquierda y el ojo veía el escalón al scrollear en mobile (auditoría
 * responsive 2026-07-22: bordes medidos 20px vs 24px por sección).
 */
function Container({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("mx-auto w-full max-w-6xl px-6 sm:px-8", className)}
      {...props}
    />
  );
}

export { Container, SHELL_ESCENARIO };
