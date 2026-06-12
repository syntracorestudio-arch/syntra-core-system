"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { motion, useInView, useReducedMotion } from "framer-motion";

import { siteConfig, workflow } from "@/config/site";
import { getIcon } from "@/lib/icons";
import { EASE_PREMIUM, DURATION } from "@/lib/motion";
import { Section } from "@/components/layout/section";
import { SectionHeading } from "@/components/shared/section-heading";
import { BlurReveal } from "@/components/animations/blur-reveal";

/**
 * WorkflowSection — proceso vivo: PENDIENTE → ACTIVO → HECHO (live-system-motion-spec).
 * La línea conectora se DIBUJA (scaleX desktop / scaleY mobile) y, a medida que
 * "llega" a cada paso, ese paso completa: un destello de acento one-shot sobre el
 * chip → el badge se vuelve check cyan (queda) → aparece el entregable (queda).
 * Patrón tomado de las demos de Servicios: useInView once + useReducedMotion +
 * one-shot, sin loop. Solo se anima opacity/transform (scale/translate) — NUNCA
 * box-shadow/filter/width/height/color/background. reduced-motion → estado final
 * completo directo. CLS = 0: el slot del entregable reserva alto (min-h).
 */

/** Duración del trazo de la línea (s) — lento y premium. */
const LINE_DURATION = 1.5;

function WorkflowSection() {
  const { eyebrow, title, subtitle } = siteConfig.sections.workflow;
  const reduce = useReducedMotion();
  const ref = React.useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });

  const steps = workflow.length;
  // La secuencia arranca cuando la sección entra en viewport (o directo si reduce).
  const run = reduce || inView;

  return (
    <Section id="proceso">
      <BlurReveal>
        <SectionHeading eyebrow={eyebrow} title={title} subtitle={subtitle} />
      </BlurReveal>

      <div ref={ref} className="relative mt-16">
        {/* Línea conectora desktop (horizontal, se dibuja de izquierda a derecha) */}
        <div
          aria-hidden="true"
          className="absolute top-7 right-0 left-0 hidden h-px md:block"
        >
          {/* Riel base hairline tenue */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-border to-transparent" />
          {/* Trazo de avance (scaleX) */}
          <motion.div
            className="absolute inset-0 origin-left bg-gradient-to-r from-transparent via-brand-electric/40 to-brand-cyan/40"
            initial={reduce ? false : { scaleX: 0 }}
            animate={run ? { scaleX: 1 } : { scaleX: 0 }}
            transition={{ duration: reduce ? 0 : LINE_DURATION, ease: EASE_PREMIUM }}
          />
        </div>

        <div className="grid gap-10 md:grid-cols-4 md:gap-6">
          {workflow.map((item, i) => {
            const Icon = getIcon(item.icon);
            // El paso "i" se completa cuando la línea llega a su posición.
            const stepDelay = reduce
              ? 0
              : steps > 1
                ? (i / (steps - 1)) * LINE_DURATION
                : 0;
            return (
              <div
                key={item.step}
                className="relative flex flex-col items-center text-center"
              >
                {/* Línea conectora mobile (vertical, se dibuja de arriba abajo).
                    No después del último paso. */}
                {i < steps - 1 ? (
                  <div
                    aria-hidden="true"
                    className="absolute top-14 left-1/2 h-10 w-px -translate-x-1/2 translate-y-2 md:hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-b from-border to-transparent" />
                    <motion.div
                      className="absolute inset-0 origin-top bg-gradient-to-b from-brand-electric/40 to-brand-cyan/40"
                      initial={reduce ? false : { scaleY: 0 }}
                      animate={run ? { scaleY: 1 } : { scaleY: 0 }}
                      transition={{
                        duration: reduce ? 0 : LINE_DURATION / steps,
                        delay: stepDelay,
                        ease: EASE_PREMIUM,
                      }}
                    />
                  </div>
                ) : null}

                {/* Chip de ícono (PENDIENTE: neutro siempre visible) */}
                <span className="relative z-10 inline-flex size-14 items-center justify-center rounded-2xl border border-border-strong bg-surface-2 text-muted-foreground">
                  <Icon className="size-6" aria-hidden="true" />

                  {/* ACTIVO: destello de acento one-shot (solo opacity, sin repeat) */}
                  {!reduce ? (
                    <motion.span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 rounded-2xl border border-brand-electric/50 bg-brand-electric/10"
                      initial={{ opacity: 0 }}
                      animate={run ? { opacity: [0, 0.7, 0] } : { opacity: 0 }}
                      transition={{
                        duration: DURATION.standard,
                        delay: stepDelay,
                        ease: EASE_PREMIUM,
                      }}
                    />
                  ) : null}

                  {/* Badge de estado (esquina): PENDIENTE = anillo neutro; HECHO = check cyan */}
                  <span className="absolute -right-1.5 -top-1.5 inline-flex size-5 items-center justify-center rounded-full border border-border-strong bg-surface-2">
                    {/* PENDIENTE: dot neutro (se desvanece al completarse) */}
                    <motion.span
                      aria-hidden="true"
                      className="absolute size-1.5 rounded-full bg-muted-foreground"
                      initial={reduce ? false : { opacity: 1 }}
                      animate={run ? { opacity: 0 } : { opacity: 1 }}
                      transition={{
                        duration: reduce ? 0 : DURATION.micro,
                        delay: stepDelay,
                        ease: EASE_PREMIUM,
                      }}
                    />
                    {/* HECHO: check cyan que revela (opacity + scale) y queda */}
                    <motion.span
                      className="inline-flex text-brand-cyan"
                      initial={reduce ? false : { opacity: 0, scale: 0.8 }}
                      animate={run ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
                      transition={{
                        duration: reduce ? 0 : DURATION.standard,
                        delay: stepDelay,
                        ease: EASE_PREMIUM,
                      }}
                    >
                      <Check className="size-3" aria-hidden="true" />
                    </motion.span>
                  </span>
                </span>

                <span className="mt-4 font-accent text-xs tracking-widest text-muted-foreground">
                  PASO {String(item.step).padStart(2, "0")}
                </span>
                <h3 className="mt-1 font-heading text-lg font-semibold tracking-tight">
                  {item.title}
                </h3>
                <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
                  {item.description}
                </p>

                {/* Entregable (HECHO): aparece por opacity y queda.
                    Slot con alto reservado (min-h) → CLS = 0. */}
                <div className="mt-4 flex min-h-[2rem] items-start justify-center">
                  <motion.span
                    className="inline-flex items-center gap-1.5 rounded-full border border-brand-cyan/30 bg-surface-2 px-3 py-1 font-accent text-xs tracking-wide text-brand-cyan"
                    initial={reduce ? false : { opacity: 0 }}
                    animate={run ? { opacity: 1 } : { opacity: 0 }}
                    transition={{
                      duration: reduce ? 0 : DURATION.standard,
                      delay: reduce ? 0 : stepDelay + DURATION.micro,
                      ease: EASE_PREMIUM,
                    }}
                  >
                    <Check className="size-3" aria-hidden="true" />
                    {item.result}
                  </motion.span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Section>
  );
}

export { WorkflowSection };
