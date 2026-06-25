"use client";

import dynamic from "next/dynamic";

/**
 * CasosBackdrop — fondo vivo de Casos ("Campo de señales", reference-lock casos.md).
 * Capa client (el 3D entra lazy, ssr:false) para que la sección Casos siga siendo Server
 * Component. Base cálida que se enfría hacia abajo + campo de señales 3D + scrim de
 * legibilidad. El selector y las escenas de chat van al frente (z-10), intactos.
 */
const LivingBackground = dynamic(
  () =>
    import("@/components/marketing/living/living-background").then(
      (m) => m.LivingBackground,
    ),
  { ssr: false },
);

export function CasosBackdrop() {
  return (
    <>
      {/* Base: cálida arriba (capítulo humano) → se enfría hacia abajo (hacia Proceso) */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(75% 55% at 50% 6%, #26211c 0%, transparent 58%)," +
              "linear-gradient(180deg, #15140f 0%, #100f0d 55%, #0d0e12 100%)",
          }}
        />
        <LivingBackground variant="casos" />
        <div className="sys-canvas-grid absolute inset-0 opacity-[0.10]" />
      </div>

      {/* Scrim de legibilidad + fundido sup/inf (cose con vecinas) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[5]"
        style={{
          background:
            "linear-gradient(180deg, rgba(8,9,12,0.5) 0%, rgba(8,9,12,0.12) 16%, transparent 44%, rgba(8,9,12,0.3) 100%)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[6]"
        style={{
          background:
            "radial-gradient(130% 95% at 50% 45%, transparent 60%, rgba(6,7,9,0.45) 100%)," +
            "linear-gradient(to bottom, rgba(6,7,9,0.9) 0%, transparent 12%, transparent 88%, rgba(6,7,9,0.92) 100%)",
        }}
      />
    </>
  );
}
