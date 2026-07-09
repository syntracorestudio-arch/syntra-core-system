"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * SectionAtmosphere v3 — fondo atmosférico UNIFICADO y VIVO de la Home (2026-07-09). Base
 * + aurora + grano en CSS (estáticos, SSR); la CAPA DE CAMPO estelar ahora puede correr en
 * 3D REAL (R3F) en desktop, con la versión CSS como FALLBACK móvil/reduced-motion.
 *
 * Capas (de atrás hacia adelante):
 *  1. BASE — idéntica en todas las secciones, anclada al #05070c trasero y SIMÉTRICA
 *     (empieza y termina en #05070c) → juntura invisible entre secciones.
 *  2. AURORA — 1-2 blobs de COLOR del acento, muy difusos, que respiran (transform-only).
 *     Es color, no brillo blanco → no toca la banda de luminancia. Estos blobs aportan el
 *     TINTE de acento (el canvas 3D no suma bruma → no se duplica la luz).
 *  3. CAMPO ESTELAR — decidido por <StarField>: desktop + motion → <AtmosphereField> (R3F,
 *     lazy ssr:false, twinkle/paralaje/profundidad); mobile (<lg) o reduced-motion → las 2
 *     capas de stardust CSS deterministas (fallback). Es canvas O dots, nunca los dos
 *     (no se duplican estrellas).
 *  4. GRANO — el MISMO de la mitad trasera (anti-banding, materia).
 *
 * El componente es cliente sólo para DECIDIR el campo (media query + reduced-motion) y
 * lazy-cargar el 3D; base/aurora/grano siguen siendo markup estático (SSR). CLS 0 (todo
 * absolute inset-0; overflow-hidden contiene blobs/stars/canvas). Sin violeta/cyan.
 */

type Accent = "electric" | "warm" | "dual";

/* El 3D vive en un módulo aparte → code-split real: three/R3F sólo se descarga si el slot
 * decide montar el canvas (desktop + motion). Nunca bloquea LCP/SSR. */
const AtmosphereField = dynamic(
  () => import("./atmosphere-field").then((m) => m.AtmosphereField),
  { ssr: false },
);

/* Media query reactiva (useSyncExternalStore — React Compiler safe, sin setState en effect).
 * getServerSnapshot=false → en SSR/hidratación decide FALLBACK (dots), sin mismatch; el
 * canvas (ssr:false) recién se evalúa en cliente. */
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

/* Campo estelar: canvas 3D (desktop + motion) O dots CSS (mobile/reduced) — nunca los dos. */
function StarField({ accent }: { accent: Accent }) {
  const reduce = useReducedMotion() ?? false;
  const desktop = useMediaQuery("(min-width: 1024px)");
  if (desktop && !reduce) return <AtmosphereField accent={accent} />;
  return (
    <>
      <div className="atmo-stars atmo-stars-a" />
      <div className="atmo-stars atmo-stars-b" />
    </>
  );
}

type SectionAtmosphereProps = {
  /** Acento térmico de la sección (hace la narrativa; el resto es base común). */
  accent: Accent;
  className?: string;
};

/** Base común anclada al #05070c trasero; simétrica → tiling sin costura entre secciones. */
const BASE = "linear-gradient(180deg, #05070c 0%, #070b14 50%, #05070c 100%)";

/**
 * Blobs de aurora por acento: main del rol arriba + eco mínimo del rol vecino abajo
 * (continuidad térmica). El posicionamiento NO usa translate (colisionaría con el
 * transform de la animación); el warm-main se centra con margin negativo. Sin violeta/cyan.
 */
type Blob = { className: string; color: string };
const BLOBS: Record<Accent, Blob[]> = {
  electric: [
    { className: "atmo-blob-a -top-[18%] -right-[12%] h-[62vh] w-[58vw]", color: "rgba(37,99,235,0.16)" },
    { className: "atmo-blob-b -bottom-[20%] -left-[10%] h-[50vh] w-[48vw]", color: "rgba(231,200,160,0.07)" },
  ],
  warm: [
    { className: "atmo-blob-a -top-[20%] left-1/2 -ml-[30vw] h-[58vh] w-[60vw]", color: "rgba(217,119,6,0.14)" },
    { className: "atmo-blob-b -bottom-[22%] -right-[8%] h-[48vh] w-[46vw]", color: "rgba(37,99,235,0.07)" },
  ],
  dual: [
    { className: "atmo-blob-a -top-[16%] -left-[10%] h-[56vh] w-[52vw]", color: "rgba(37,99,235,0.13)" },
    { className: "atmo-blob-b -bottom-[20%] -right-[8%] h-[56vh] w-[52vw]", color: "rgba(217,119,6,0.11)" },
  ],
};

/** Grano compartido con la mitad trasera (FAQ/Nosotros): fractalNoise SVG, mix-blend-overlay. */
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")";

function SectionAtmosphere({ accent, className }: SectionAtmosphereProps) {
  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0 z-0 overflow-hidden", className)}
    >
      {/* 1 · Base común */}
      <div className="absolute inset-0" style={{ background: BASE }} />

      {/* 2 · Aurora (color del acento que respira) */}
      {BLOBS[accent].map((blob, i) => (
        <div
          key={i}
          className={cn("atmo-blob", blob.className)}
          style={{ background: `radial-gradient(circle, ${blob.color}, transparent 70%)` }}
        />
      ))}

      {/* 3 · Campo estelar — 3D real (desktop) o 2 capas de dots CSS (fallback) */}
      <StarField accent={accent} />

      {/* 4 · Grano (materia, anti-banding) */}
      <div
        className="absolute inset-0 opacity-[0.05] mix-blend-overlay"
        style={{ backgroundImage: GRAIN }}
      />
    </div>
  );
}

export { SectionAtmosphere };
