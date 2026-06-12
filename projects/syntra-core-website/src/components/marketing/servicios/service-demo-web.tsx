"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { motion, useInView, useReducedMotion } from "framer-motion";

import { EASE_PREMIUM, DURATION } from "@/lib/motion";

/**
 * ServiceDemoWeb — la web captura una visita: PENDIENTE → ACTIVO → HECHO
 * (live-system-motion-spec). El wireframe queda presente como chasis. Una visita
 * (dot abstracto, sin avatar/cara/emoji) entra desde un borde y se desplaza
 * (translate) hacia el botón CTA; al llegar, el CTA destella ACTIVO one-shot
 * (overlay opacity, sin repeat) y una tarjeta "Nueva consulta lista" (check cyan)
 * revela (opacity + y) en la bandeja y QUEDA (HECHO persistente).
 * Patrón: useInView once + useReducedMotion + one-shot, sin loop.
 * Solo se anima opacity/transform (translate/scale) — NUNCA box-shadow/filter/
 * width/height/color/background. reduced-motion → wireframe + tarjeta final
 * directos, sin visita animada. CLS = 0: la bandeja reserva alto (min-h).
 * Labels en lenguaje de cliente. Decorativo: aria-hidden. Tokens existentes.
 */

/** Etiqueta de cierre — lenguaje de cliente (sin jerga). */
const HECHO_LABEL = "Nueva consulta lista";
/** Duración del recorrido de la visita hacia el CTA (s) — lento y premium. */
const TRAVEL = 1.1;

function ServiceDemoWeb() {
  const reduce = useReducedMotion();
  const ref = React.useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  // La secuencia arranca al entrar en viewport (o directo si reduce).
  const run = reduce || inView;

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="relative rounded-xl border border-border bg-depth-sunken p-5 sm:p-6"
    >
      <div className="flex flex-col gap-4">
        {/* Barra superior (nav) */}
        <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-2 px-3 py-2.5">
          <span className="size-2.5 rounded-full bg-brand-cyan/70" />
          <span className="h-2 w-16 rounded-full bg-border-strong" />
          <div className="ml-auto flex items-center gap-2">
            <span className="h-2 w-8 rounded-full bg-border-strong" />
            <span className="h-2 w-8 rounded-full bg-border-strong" />
            <span className="h-2 w-12 rounded-full bg-brand-electric/30" />
          </div>
        </div>

        {/* Bloque hero */}
        <div className="rounded-lg border border-border bg-surface-2 p-4">
          <div className="flex flex-col gap-2.5">
            <span className="h-3 w-3/5 rounded-full bg-border-strong" />
            <span className="h-2 w-4/5 rounded-full bg-border-strong/70" />
            <span className="h-2 w-2/5 rounded-full bg-border-strong/70" />
            {/* CTA del wireframe — destino de la visita. El overlay de acento
                destella ACTIVO one-shot (solo opacity) cuando la visita llega. */}
            <span className="relative mt-1 inline-flex h-6 w-24 overflow-hidden rounded-md border border-brand-electric/30 bg-brand-electric/10">
              {!reduce ? (
                <motion.span
                  className="pointer-events-none absolute inset-0 rounded-md bg-brand-electric/40"
                  initial={{ opacity: 0 }}
                  animate={run ? { opacity: [0, 0.7, 0] } : { opacity: 0 }}
                  transition={{
                    duration: DURATION.standard,
                    delay: TRAVEL,
                    ease: EASE_PREMIUM,
                  }}
                />
              ) : null}
            </span>
          </div>
        </div>

        {/* Grilla de contenido */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface-2 p-3">
            <span className="size-6 rounded-md bg-border-strong" />
            <span className="h-2 w-3/4 rounded-full bg-border-strong" />
            <span className="h-2 w-1/2 rounded-full bg-border-strong/70" />
          </div>
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface-2 p-3">
            <span className="size-6 rounded-md bg-border-strong" />
            <span className="h-2 w-3/4 rounded-full bg-border-strong" />
            <span className="h-2 w-1/2 rounded-full bg-border-strong/70" />
          </div>
        </div>

        {/* Bandeja (HECHO): tarjeta "Nueva consulta lista" revela y QUEDA.
            Slot con alto reservado (min-h) → CLS = 0. */}
        <div className="flex min-h-[2.5rem] items-start">
          <motion.span
            className="inline-flex items-center gap-1.5 rounded-full border border-brand-cyan/30 bg-surface-2 px-3 py-1.5 font-accent text-xs tracking-wide text-brand-cyan"
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={run ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
            transition={{
              duration: reduce ? 0 : DURATION.standard,
              delay: reduce ? 0 : TRAVEL + DURATION.standard,
              ease: EASE_PREMIUM,
            }}
          >
            <Check className="size-3" aria-hidden="true" />
            {HECHO_LABEL}
          </motion.span>
        </div>
      </div>

      {/* Visita abstracta (dot, sin avatar/cara/emoji): entra desde el borde
          izquierdo y se desplaza (translate) hacia el CTA. Solo opacity/transform.
          Ausente en reduced-motion (estado final ya completo). */}
      {!reduce ? (
        <motion.span
          aria-hidden="true"
          className="pointer-events-none absolute top-6 left-5 z-10 size-2.5 rounded-full bg-brand-electric sm:left-6"
          initial={{ opacity: 0, x: -16, y: 0 }}
          animate={
            run
              ? { opacity: [0, 1, 1, 0], x: [-16, 40, 120, 150], y: [0, 30, 70, 96] }
              : { opacity: 0 }
          }
          transition={{
            duration: TRAVEL,
            ease: EASE_PREMIUM,
            times: [0, 0.2, 0.85, 1],
          }}
        />
      ) : null}
    </div>
  );
}

export { ServiceDemoWeb };
