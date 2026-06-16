"use client";

import * as React from "react";
import { Check, Lock } from "lucide-react";
import {
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";

import { EASE_PREMIUM, DURATION } from "@/lib/motion";
import { SceneFrame, SceneAtmosphere } from "./scene-frame";

/**
 * ServiceDemoWeb — escena premium (WEB-009F-A). Deja de ser wireframe: se siente
 * como producto real + resultado visible. Ancla visual Vercel (escena oscura
 * enmarcada + glow atmosférico) + Raycast (frame de producto + tarjeta-resultado
 * que flota con profundidad). Paleta SYNTRA (slate / brand-electric / brand-cyan,
 * regla 90/10). Atmósfera 100% CSS (sin raster: NO usa next/image).
 *
 * Tres planos Z:
 *  1. Fondo atmosférico (radial mesh azul/cyan por opacidad + grilla `sys-canvas-grid`).
 *  2. Frame de navegador premium con mini-landing de alta fidelidad (texto real).
 *  3. Tarjeta-resultado flotante (Raycast) que se solapa al frame y PERSISTE (HECHO).
 *
 * Motion (live-system-motion-spec): patrón PENDIENTE → ACTIVO → HECHO, reveal por
 * capas, one-shot por viewport (useInView once + useReducedMotion). Solo se anima
 * opacity/transform (translate/scale) — NUNCA box-shadow/filter/width/height/color/
 * background. Sin loops, sin parallax-scroll, sin partículas. Hover de profundidad
 * sutil (desktop fine-pointer) vía motion values; off en touch y reduced-motion.
 * reduced-motion → escena final completa directa (fondo + frame + landing + tarjeta
 * + badge), sin reveal ni hover. CLS = 0: contenedor con alto reservado; lo que
 * aparece entra por opacity/transform en slots dimensionados. Decorativo: aria-hidden.
 */

/* `SceneFrame` + `SceneAtmosphere` se comparten desde `./scene-frame` (extraídos
   en 009F-B para que Web y Automatización usen un solo chasis/atmósfera, sin drift). */

/* Timing de la secuencia por capas (s). Amplitudes/delays DISTINTOS por plano
   → eso construye la profundidad. Curva y duraciones de `lib/motion`. */
const T_BG = 0; // fondo revela primero
const T_FRAME = 0.18; // el frame sube después
const T_CTA = 0.74; // el indicador de visita llega y el CTA destella ACTIVO
const T_CARD = 1.0; // la tarjeta-resultado revela y queda (HECHO)

function ServiceDemoWeb() {
  const reduce = useReducedMotion();
  const ref = React.useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.25 });
  // La secuencia arranca al entrar en viewport (o directo si reduce).
  const run = reduce || inView;

  // ── Hover de profundidad (desktop fine-pointer). Motion values suavizados;
  // cada plano se desplaza pocos px en sentidos distintos → parallax de puntero.
  // Off en touch (sin pointer fino) y en reduced-motion: nunca se actualizan.
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sx = useSpring(px, { stiffness: 120, damping: 18, mass: 0.4 });
  const sy = useSpring(py, { stiffness: 120, damping: 18, mass: 0.4 });
  // Fondo se mueve menos (lejos); tarjeta más (cerca) → sensación de capas.
  const bgX = useTransform(sx, [-0.5, 0.5], [-3, 3]);
  const bgY = useTransform(sy, [-0.5, 0.5], [-3, 3]);
  const frameX = useTransform(sx, [-0.5, 0.5], [8, -8]);
  const frameY = useTransform(sy, [-0.5, 0.5], [8, -8]);
  const cardX = useTransform(sx, [-0.5, 0.5], [18, -18]);
  const cardY = useTransform(sy, [-0.5, 0.5], [16, -16]);

  const hoverEnabled = !reduce;

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    // Solo punteros finos (mouse/trackpad): evita drift en táctil.
    if (!hoverEnabled || e.pointerType !== "mouse") return;
    const rect = e.currentTarget.getBoundingClientRect();
    px.set((e.clientX - rect.left) / rect.width - 0.5);
    py.set((e.clientY - rect.top) / rect.height - 0.5);
  }
  function handlePointerLeave() {
    px.set(0);
    py.set(0);
  }

  return (
    <div
      ref={ref}
      aria-hidden="true"
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className="relative"
    >
      {/* Wrapper relativo SIN overflow: deja que la tarjeta-resultado flote fuera
          del frame sin recortarse (el SceneFrame sí recorta su atmósfera). */}
      <div className="relative">
        <SceneFrame
          background={
          // ── Plano 1: fondo atmosférico (detrás). Glow mesh radial azul/cyan
          // por OPACIDAD (nunca box-shadow animado) + grilla técnica con máscara.
          <motion.div
            aria-hidden="true"
            className="absolute inset-0"
            style={hoverEnabled ? { x: bgX, y: bgY } : undefined}
            initial={reduce ? false : { opacity: 0 }}
            animate={run ? { opacity: 1 } : { opacity: 0 }}
            transition={{
              duration: reduce ? 0 : DURATION.hero,
              delay: reduce ? 0 : T_BG,
              ease: EASE_PREMIUM,
            }}
          >
            <SceneAtmosphere />
          </motion.div>
        }
      >
        {/* ── Plano 2: frame de navegador premium (mid). Sube con opacity+y. */}
        <motion.div
          className="relative"
          style={hoverEnabled ? { x: frameX, y: frameY } : undefined}
          initial={reduce ? false : { opacity: 0, y: 22 }}
          animate={run ? { opacity: 1, y: 0 } : { opacity: 0, y: 22 }}
          transition={{
            duration: reduce ? 0 : DURATION.hero,
            delay: reduce ? 0 : T_FRAME,
            ease: EASE_PREMIUM,
          }}
        >
          <div className="overflow-hidden rounded-xl border border-border bg-surface-1 shadow-sm">
            {/* Chrome sobrio tipo ventana-de-producto */}
            <div className="flex items-center gap-3 border-b border-border bg-surface-2 px-4 py-2.5">
              <div className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-border-strong" />
                <span className="size-2.5 rounded-full bg-border-strong" />
                <span className="size-2.5 rounded-full bg-border-strong" />
              </div>
              <div className="ml-2 flex items-center gap-1.5 rounded-md border border-border bg-depth-sunken px-2.5 py-1">
                <Lock className="size-3 text-muted-foreground" aria-hidden="true" />
                <span className="font-mono text-xs text-muted-foreground">
                  tunegocio.com
                </span>
              </div>
            </div>

            {/* Mini-landing de alta fidelidad (texto real, no placeholders) */}
            <div className="flex flex-col gap-4 p-5 sm:p-6">
              <span className="font-accent text-[0.65rem] uppercase tracking-widest text-muted-foreground/70">
                Estudio profesional · ejemplo
              </span>

              {/* Franja "hero": mesh on-brand en CSS (azul/cyan, no foto/gris) */}
              <div className="relative overflow-hidden rounded-lg border border-border p-6 sm:p-7">
                <div
                  aria-hidden="true"
                  className="absolute inset-0"
                  style={{
                    background:
                      "radial-gradient(70% 80% at 18% 0%, rgba(37,99,235,0.28), transparent 70%), radial-gradient(60% 70% at 90% 100%, rgba(56,189,248,0.22), transparent 72%), linear-gradient(135deg, #111c33, #0b1120)",
                  }}
                />
                <div className="relative flex flex-col gap-2">
                  <h4 className="font-heading text-lg font-semibold leading-snug tracking-tight text-foreground text-balance sm:text-xl">
                    Tu negocio presentado con claridad
                  </h4>
                  <p className="text-xs leading-relaxed text-muted-foreground text-pretty sm:text-sm">
                    Mostrá tus servicios, generá confianza y recibí consultas
                    desde un solo lugar.
                  </p>
                </div>
              </div>

              {/* CTA real (cta-sweep). El overlay de acento destella ACTIVO
                  one-shot (solo opacity) cuando la visita llega. */}
              <div className="relative inline-flex w-fit">
                <span className="cta-sweep relative inline-flex items-center justify-center overflow-hidden rounded-md border border-brand-electric/40 bg-brand-electric/15 px-5 py-2.5 text-sm font-medium text-foreground">
                  Solicitar información
                  {!reduce ? (
                    <motion.span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 rounded-md bg-brand-electric/45"
                      initial={{ opacity: 0 }}
                      animate={run ? { opacity: [0, 0.85, 0.85, 0] } : { opacity: 0 }}
                      transition={{
                        duration: DURATION.standard,
                        delay: T_CTA,
                        ease: EASE_PREMIUM,
                      }}
                    />
                  ) : null}
                </span>
              </div>
            </div>
          </div>
        </motion.div>
        </SceneFrame>

        {/* ── Plano 3: tarjeta-resultado flotante (front, Raycast). Hermana del
            SceneFrame dentro del wrapper SIN overflow → se solapa al borde inferior
            del frame y NO se recorta. Revela y QUEDA (HECHO persiste).
            Slot con alto reservado (min-h) → CLS = 0. */}
        <div className="pointer-events-none absolute right-3 -bottom-4 z-20 flex min-h-[4rem] w-[16.5rem] max-w-[78%] justify-end sm:right-5 sm:-bottom-5 sm:w-[17rem]">
          <motion.div
            style={hoverEnabled ? { x: cardX, y: cardY } : undefined}
            initial={reduce ? false : { opacity: 0, y: 20, scale: 0.94 }}
            animate={
              run
                ? { opacity: 1, y: 0, scale: 1 }
                : { opacity: 0, y: 20, scale: 0.94 }
            }
            transition={{
              duration: reduce ? 0 : DURATION.section,
              delay: reduce ? 0 : T_CARD,
              ease: EASE_PREMIUM,
            }}
            className="surface-glass w-full rounded-xl border border-brand-cyan/40 bg-surface-2/90 p-4"
          >
            <div className="flex items-center gap-2">
              <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-brand-cyan/40 bg-brand-cyan/15">
                <Check className="size-3 text-brand-cyan" aria-hidden="true" />
              </span>
              <span className="font-accent text-[0.75rem] tracking-wide text-brand-cyan">
                Nueva consulta · ejemplo
              </span>
            </div>
            <p className="mt-2 text-xs leading-snug text-muted-foreground">
              &quot;Quiero más información para mi negocio&quot;
            </p>
          </motion.div>
        </div>
      </div>

      {/* Badge de honestidad (lenguaje de cliente) */}
      <p className="mt-7 text-xs text-muted-foreground">
        Ejemplo · no es un cliente real
      </p>
    </div>
  );
}

export { ServiceDemoWeb };
