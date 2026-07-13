"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useReducedMotion } from "framer-motion";

/**
 * PanelVida — decider cliente de la capa de vida del panel image-led de Contacto
 * (patrón section-atmosphere): desktop lg+ y !reduced-motion → monta las brasas
 * 3D (lazy, ssr:false); si no → null (la imagen de marca sola es el fallback
 * digno). El Server Component (final-cta-section) lo usa como una línea.
 */

/* El 3D vive en módulo aparte → code-split real: three/R3F solo se descargan si
 * el decider decide montar el canvas. Nunca bloquea LCP/SSR. */
const PanelVidrio3D = dynamic(
  () => import("./panel-vidrio-3d").then((m) => m.PanelVidrio3D),
  { ssr: false },
);

/* Media query reactiva (useSyncExternalStore — React Compiler safe, sin setState
 * en effect). getServerSnapshot=false → SSR/hidratación deciden FALLBACK (nada),
 * sin mismatch; el canvas (ssr:false) recién se evalúa en cliente. */
function useMediaQuery(query: string) {
  const subscribe = React.useCallback(
    (cb: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", cb);
      return () => mql.removeEventListener("change", cb);
    },
    [query],
  );
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

function PanelVida() {
  const reduce = useReducedMotion() ?? false;
  const desktop = useMediaQuery("(min-width: 1024px)");
  if (!desktop || reduce) return null;
  return <PanelVidrio3D />;
}

export { PanelVida };
