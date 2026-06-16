import * as React from "react";

/**
 * SceneFrame — chasis compartido de las escenas premium de Servicios
 * (Web / Automatización / IA). Extraído del piloto Web (WEB-009F-A) para que las
 * escenas compartan una sola fuente de verdad del contenedor (radio, borde, alto
 * reservado, atmósfera recortada) y no derive el design system.
 *
 * Reserva alto (min-h responsive) → CLS = 0: lo que aparece dentro entra por
 * opacity/transform, nunca empuja el flujo. El fondo va detrás (slot absoluto,
 * recortado por overflow-hidden), el contenido encima en un plano relativo.
 * Decorativo: el `aria-hidden` lo pone el consumidor en su contenedor raíz.
 *
 * IMPORTANTE: una tarjeta-resultado que deba "flotar" fuera del frame (Raycast) va
 * FUERA del SceneFrame, en un wrapper relativo SIN overflow — el SceneFrame recorta
 * su atmósfera, el wrapper deja flotar la tarjeta sin recortarla.
 */
function SceneFrame({
  background,
  children,
}: {
  background: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-[20rem] overflow-hidden rounded-2xl border border-border bg-depth-sunken p-5 sm:min-h-[22rem] sm:p-6">
      {/* Slot de fondo (plano 1) */}
      {background}
      {/* Slot de contenido (planos 2–3) */}
      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
}

/**
 * SceneAtmosphere — atmósfera compartida: mesh radial azul/cyan por OPACIDAD (no
 * multicolor, estilo Vercel) + grilla técnica (`sys-canvas-grid`, con su máscara).
 * Estática (sin motion): cada escena la envuelve en su propio `motion.div` para el
 * reveal por capas + el parallax de puntero. Misma fuente de verdad de opacidades
 * (0.18 electric / 0.14 cyan) → sin drift entre escenas. Decorativa.
 */
function SceneAtmosphere() {
  return (
    <>
      {/* Dark mesh gradient azul/cyan (solo on-brand, no multicolor) */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 55% at 30% 22%, rgba(37,99,235,0.18), transparent 70%), radial-gradient(55% 50% at 78% 82%, rgba(56,189,248,0.14), transparent 72%)",
        }}
      />
      {/* Grilla técnica sutil (clase existente: trama + máscara radial) */}
      <div aria-hidden="true" className="absolute inset-0 sys-canvas-grid" />
    </>
  );
}

export { SceneFrame, SceneAtmosphere };
