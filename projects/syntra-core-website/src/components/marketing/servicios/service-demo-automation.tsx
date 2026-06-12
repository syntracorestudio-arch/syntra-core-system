"use client";

import * as React from "react";
import { ArrowDown, ArrowRight, Check, Inbox, ListChecks } from "lucide-react";
import { motion, useInView, useReducedMotion } from "framer-motion";

import { EASE_PREMIUM, DURATION } from "@/lib/motion";

/**
 * ServiceDemoAutomation — la consulta se ordena sola: PENDIENTE → ACTIVO → HECHO
 * (live-system-motion-spec). One-shot disparado por viewport (sin loop): el acento
 * recorre los 3 nodos (Entra → Se ordena → Avisa) UNA sola vez, un nodo ACTIVO por
 * vez (overlay opacity, sin repeat); cada nodo queda HECHO con un check cyan
 * persistente (opacity + scale) y el dot neutro se desvanece. Bajo el último nodo,
 * un badge "Te llega el aviso" (check cyan) revela y QUEDA (HECHO persistente).
 * Patrón: useInView once + useReducedMotion + one-shot, sin loop (mismo que Proceso).
 * Solo se anima opacity/transform (scale/translate) — NUNCA box-shadow/filter/
 * width/height/color/background. reduced-motion → 3 checks + badge en estado HECHO,
 * sin animación. CLS = 0: el badge reserva alto (min-h). Conector reusado del repo.
 * Labels en lenguaje de cliente, sin jerga técnica. Decorativo: aria-hidden.
 */

/** Etiqueta de cierre — lenguaje de cliente (sin jerga). */
const HECHO_LABEL = "Te llega el aviso";

const nodes = [
  { icon: Inbox, label: "Entra" },
  { icon: ListChecks, label: "Se ordena" },
  { icon: Check, label: "Avisa" },
] as const;

/** Duración del recorrido del acento por los 3 nodos (s) — lento y premium. */
const SWEEP = 1.5;

function ServiceDemoAutomation() {
  const reduce = useReducedMotion();
  const ref = React.useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  // La secuencia arranca al entrar en viewport (o directo si reduce).
  const run = reduce || inView;

  const count = nodes.length;

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="rounded-xl border border-border bg-depth-sunken p-5 sm:p-6"
    >
      <div className="flex flex-col items-stretch gap-3 lg:flex-row lg:items-start lg:justify-between">
        {nodes.map((node, index) => {
          const Icon = node.icon;
          const isLast = index === count - 1;
          // El nodo "index" completa cuando el acento llega a su posición.
          const stepDelay = reduce
            ? 0
            : count > 1
              ? (index / (count - 1)) * SWEEP
              : 0;
          return (
            <div
              key={node.label}
              className="flex flex-col items-center gap-3 lg:flex-1 lg:flex-row lg:items-start lg:gap-0"
            >
              {/* Nodo */}
              <div className="flex flex-1 flex-col items-center gap-2 lg:flex-none">
                <span className="relative flex size-12 items-center justify-center rounded-xl border border-border-strong bg-surface-2 text-muted-foreground">
                  {/* ACTIVO: destello de acento one-shot (solo opacity, sin repeat) */}
                  {!reduce ? (
                    <motion.span
                      className="pointer-events-none absolute inset-0 rounded-xl border border-brand-electric/50 bg-brand-electric/10"
                      initial={{ opacity: 0 }}
                      animate={run ? { opacity: [0, 0.7, 0] } : { opacity: 0 }}
                      transition={{
                        duration: DURATION.standard,
                        delay: stepDelay,
                        ease: EASE_PREMIUM,
                      }}
                    />
                  ) : null}
                  <Icon className="size-5" />

                  {/* Badge de estado (esquina): PENDIENTE = dot neutro; HECHO = check cyan */}
                  <span className="absolute -right-1.5 -top-1.5 inline-flex size-5 items-center justify-center rounded-full border border-border-strong bg-surface-2">
                    {/* PENDIENTE: dot neutro (se desvanece al completarse) */}
                    <motion.span
                      className="absolute size-1.5 rounded-full bg-muted-foreground"
                      initial={reduce ? false : { opacity: 1 }}
                      animate={run ? { opacity: 0 } : { opacity: 1 }}
                      transition={{
                        duration: reduce ? 0 : DURATION.micro,
                        delay: stepDelay,
                        ease: EASE_PREMIUM,
                      }}
                    />
                    {/* HECHO: check cyan que revela (opacity + scale) y QUEDA */}
                    <motion.span
                      className="inline-flex text-brand-cyan"
                      initial={reduce ? false : { opacity: 0, scale: 0.8 }}
                      animate={
                        run ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }
                      }
                      transition={{
                        duration: reduce ? 0 : DURATION.standard,
                        delay: stepDelay,
                        ease: EASE_PREMIUM,
                      }}
                    >
                      <Check className="size-3" />
                    </motion.span>
                  </span>
                </span>
                <span className="text-xs text-muted-foreground">{node.label}</span>

                {/* Badge de cierre (HECHO): solo bajo el último nodo ("Avisa").
                    Revela por opacity + y y QUEDA. Slot con min-h → CLS = 0. */}
                {isLast ? (
                  <div className="flex min-h-[2rem] items-start justify-center">
                    <motion.span
                      className="inline-flex items-center gap-1.5 rounded-full border border-brand-cyan/30 bg-surface-2 px-3 py-1 font-accent text-xs tracking-wide text-brand-cyan"
                      initial={reduce ? false : { opacity: 0, y: 6 }}
                      animate={run ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
                      transition={{
                        duration: reduce ? 0 : DURATION.standard,
                        delay: reduce ? 0 : SWEEP + DURATION.micro,
                        ease: EASE_PREMIUM,
                      }}
                    >
                      <Check className="size-3" />
                      {HECHO_LABEL}
                    </motion.span>
                  </div>
                ) : null}
              </div>

              {/* Conector (no después del último nodo) */}
              {!isLast ? (
                <>
                  {/* Mobile: vertical */}
                  <div className="flex flex-col items-center lg:hidden">
                    <span className="h-5 w-px bg-gradient-to-b from-border to-brand-electric/40" />
                    <ArrowDown className="size-4 text-brand-electric/60" />
                  </div>
                  {/* Desktop: horizontal (alineado al nodo, no al badge) */}
                  <div className="hidden items-center lg:flex lg:mt-3.5">
                    <span className="h-px w-6 bg-gradient-to-r from-border to-brand-electric/40 xl:w-10" />
                    <ArrowRight className="size-4 text-brand-electric/60" />
                  </div>
                </>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { ServiceDemoAutomation };
