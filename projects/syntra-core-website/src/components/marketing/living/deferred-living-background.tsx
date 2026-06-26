"use client";

import * as React from "react";
import { useInView } from "framer-motion";
import dynamic from "next/dynamic";

import type { LivingVariant } from "./living-background";

/**
 * DeferredLivingBackground — gate de MONTAJE por viewport del fondo vivo 3D.
 *
 * Por qué existe (perf, doctrina §2-3 / skill syntra-living-motion):
 *  - El `dynamic(ssr:false)` de R3F/drei no bloquea SSR/LCP, pero el chunk three/R3F SÍ
 *    baja en first-load si las 4 secciones con 3D (Servicios, Casos, Proceso) montan apenas
 *    carga la página: están todas en el árbol del scroll único → sus dynamic imports se
 *    disparan de inmediato. Este wrapper centraliza el `dynamic(...)` UNA sola vez y sólo
 *    monta <LivingBackground> cuando la sección se ACERCA al viewport (useInView con margin
 *    generoso) → el chunk no baja en first-load, sino al aproximarse.
 *
 * Continuidad de la luz única Casos→Proceso (NO se rompe):
 *  - `margin: "700px 0px"` arma el montaje ~700px ANTES de entrar al viewport. Casos y
 *    Proceso son ADYACENTES, así que ese pre-roll garantiza que AMBAS estén montadas (y su
 *    useScroll/useMotionValueEvent escribiendo en journeyStore) bastante antes de la unión.
 *    El handoff de la cresta (Casos→nodo→Proceso, SPLIT=0.5) nunca encuentra una sección
 *    sin montar en la zona de la costura.
 *  - `once: true`: una vez montado NO se desmonta → el fondo no parpadea ni reinicia el
 *    journey al hacer scroll hacia arriba/abajo.
 *
 * CLS 0: el contenedor es `absolute inset-0` (capa de fondo) → no reserva alto ni empuja
 * layout. Antes de montar no pinta nada. reduced-motion lo maneja LivingBackground (Poster);
 * acá montamos igual (el poster es barato) — pero el gate por viewport igual difiere el chunk.
 */

const LivingBackground = dynamic(
  () => import("./living-background").then((m) => m.LivingBackground),
  { ssr: false, loading: () => null },
);

type DeferredLivingBackgroundProps = {
  variant: LivingVariant;
  className?: string;
};

export function DeferredLivingBackground({
  variant,
  className,
}: DeferredLivingBackgroundProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  // margin generoso (~700px): pre-monta antes de entrar al viewport para que Casos y
  // Proceso (adyacentes) estén ambas vivas antes de la unión. once: no desmonta jamás.
  const inView = useInView(ref, { margin: "700px 0px", once: true });

  return (
    <div ref={ref} aria-hidden="true" className="absolute inset-0">
      {inView ? (
        <LivingBackground variant={variant} className={className} />
      ) : null}
    </div>
  );
}

export default DeferredLivingBackground;
