"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useReducedMotion } from "framer-motion";

/**
 * HeroAnillos — decider de la escena del Hero (el vórtice + "La Tinta" de fondo).
 * Desktop lg+ y sin reduced-motion → monta la escena 3D (lazy, ssr:false;
 * three solo se descarga si se va a usar). Mobile o reduced-motion → null
 * (queda la base CSS del hero + el póster horneado, cero costo).
 */

const HeroAnillos3D = dynamic(
  () => import("./hero-anillos-3d").then((m) => m.HeroAnillos3D),
  { ssr: false },
);

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

function HeroAnillos() {
  const reduce = useReducedMotion() ?? false;
  const desktop = useMediaQuery("(min-width: 1024px)");
  if (!desktop || reduce) return null;
  return <HeroAnillos3D />;
}

export { HeroAnillos };
