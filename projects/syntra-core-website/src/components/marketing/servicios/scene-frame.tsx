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
    <div className="relative min-h-[22rem] overflow-hidden rounded-2xl border border-border bg-depth-sunken p-5 sm:min-h-[24rem] sm:p-6 lg:min-h-[26rem]">
      {/* Slot de fondo (plano 1) */}
      {background}
      {/* Slot de contenido (planos 2–3) */}
      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
}

/**
 * Temperatura de la atmósfera por servicio (Sprint 01 — color roles + rhythm).
 * Rompe la monotonía de 3 paneles idénticos en Servicios SIN tocar el chasis:
 * solo cambia el mesh de fondo, a baja opacidad (regla 90/10). El azul sigue
 * siendo acción; cyan = sistema; violeta = IA; ámbar = humano (filo, muy sutil).
 *   - "system" (default): azul/cyan original → NO cambia Contacto ni hero-visual.
 *   - "web":        azul/electric protagonista.
 *   - "ai":         violeta/indigo (Automatización pasa por el "cerebro").
 *   - "warm":       cyan + un filo ámbar muy sutil (IA respondiendo a un humano).
 */
const ATMOSPHERE_MESH = {
  system:
    "radial-gradient(60% 55% at 30% 22%, rgba(37,99,235,0.18), transparent 70%), radial-gradient(55% 50% at 78% 82%, rgba(56,189,248,0.14), transparent 72%)",
  web: "radial-gradient(60% 55% at 28% 20%, rgba(37,99,235,0.22), transparent 70%), radial-gradient(55% 50% at 80% 84%, rgba(56,189,248,0.10), transparent 72%)",
  ai: "radial-gradient(60% 55% at 30% 22%, rgba(109,93,251,0.20), transparent 70%), radial-gradient(55% 50% at 80% 84%, rgba(37,99,235,0.10), transparent 72%)",
  warm: "radial-gradient(60% 55% at 30% 22%, rgba(56,189,248,0.16), transparent 70%), radial-gradient(55% 52% at 80% 86%, rgba(231,200,160,0.09), transparent 72%)",
} as const;

type AtmosphereTone = keyof typeof ATMOSPHERE_MESH;

/**
 * SceneAtmosphere — atmósfera compartida: mesh radial por OPACIDAD (estilo Vercel)
 * + grilla técnica (`sys-canvas-grid`, con su máscara). Estática (sin motion): cada
 * escena la envuelve en su propio `motion.div` para el reveal por capas + el
 * parallax de puntero. `tone` define la temperatura (default "system" = azul/cyan
 * original, para no alterar Contacto/hero-visual). Decorativa.
 */
function SceneAtmosphere({ tone = "system" }: { tone?: AtmosphereTone }) {
  return (
    <>
      {/* Dark mesh gradient (temperatura por `tone`, on-brand, baja opacidad) */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{ background: ATMOSPHERE_MESH[tone] }}
      />
      {/* Grilla técnica sutil (clase existente: trama + máscara radial) */}
      <div aria-hidden="true" className="absolute inset-0 sys-canvas-grid" />
    </>
  );
}

export { SceneFrame, SceneAtmosphere };
