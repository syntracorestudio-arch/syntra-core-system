"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { motion, useReducedMotion, type Variants } from "framer-motion";

import { cn } from "@/lib/utils";
import { TransformConnector } from "@/components/marketing/para-quien/transform-connector";

interface IndustryBandProps {
  index: number;
  /** Rótulo (ícono + nombre) renderizado en Server y pasado como children. */
  label: React.ReactNode;
  pain: string;
  solutions: string[];
  /** Deriva de index % 2. Solo invierte el orden VISUAL en desktop. */
  reversed: boolean;
}

// Easing exacto de la spec.
const EASE = [0.22, 1, 0.36, 1] as const;
const VIEWPORT = { once: true, amount: 0.3 } as const;

/**
 * IndustryBand — banda full-width "antes / después" (spec para-quien-v1).
 * Una instancia por rubro. Reveal único al entrar en viewport con beat
 * narrativo de 300ms entre "antes" y "después". Respeta prefers-reduced-motion.
 * DOM lógico: rótulo → antes → después (la alternancia es solo visual).
 */
function IndustryBand({
  label,
  pain,
  solutions,
  reversed,
}: IndustryBandProps) {
  const reduce = useReducedMotion();

  const t = (delay: number) =>
    reduce ? { duration: 0 } : { duration: 0.35, ease: EASE, delay };

  const fadeUp: Variants = {
    hidden: reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };
  const fadeIn: Variants = {
    hidden: reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 },
    visible: { opacity: 1, y: 0 },
  };
  const checksContainer: Variants = {
    hidden: {},
    visible: {
      transition: reduce ? {} : { staggerChildren: 0.09, delayChildren: 0.95 },
    },
  };
  const checkItem: Variants = {
    hidden: reduce ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.3, ease: EASE } },
  };

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={VIEWPORT}
      className="grid items-center gap-6 md:min-h-[380px] md:grid-cols-[1fr_auto_1fr] md:gap-8 lg:min-h-[420px]"
    >
      {/* Lado "antes" (gris, apagado) — beat: aparece +0.12s tras el rótulo */}
      <motion.div
        variants={fadeIn}
        transition={t(0.12)}
        className={cn(
          "flex flex-col gap-4",
          reversed ? "md:order-3" : "md:order-1",
        )}
      >
        <motion.div variants={fadeUp} transition={t(0)}>
          {label}
        </motion.div>

        <p className="text-xs font-medium tracking-widest text-muted-foreground/70 uppercase">
          Antes
        </p>
        <p className="max-w-md leading-relaxed text-muted-foreground">{pain}</p>
      </motion.div>

      {/* Conector (orden visual central siempre) */}
      <div className="md:order-2">
        <TransformConnector />
      </div>

      {/* Lado "después" (iluminado, acento azul) — tras beat de 300ms */}
      <motion.div
        variants={fadeUp}
        transition={t(0.62)}
        className={cn(
          "relative flex flex-col gap-4 rounded-2xl border border-brand-electric/20 bg-brand-electric/[0.04] p-6",
          reversed ? "md:order-1" : "md:order-3",
        )}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -inset-2 -z-10 rounded-3xl bg-brand-electric/10 blur-2xl"
        />
        <p className="text-xs font-medium tracking-widest text-brand-cyan uppercase">
          Después
        </p>
        <motion.ul variants={checksContainer} className="flex flex-col gap-2.5">
          {solutions.map((solution) => (
            <motion.li
              key={solution}
              variants={checkItem}
              className="flex items-start gap-2.5 text-sm text-foreground"
            >
              <Check
                className="mt-0.5 size-4 shrink-0 text-brand-cyan"
                aria-hidden="true"
              />
              {solution}
            </motion.li>
          ))}
        </motion.ul>
      </motion.div>
    </motion.div>
  );
}

export { IndustryBand };
