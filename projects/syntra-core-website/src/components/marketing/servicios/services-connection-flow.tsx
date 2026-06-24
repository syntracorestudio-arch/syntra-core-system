"use client";

import * as React from "react";
import { ArrowRight } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

import { servicesConnection } from "@/config/site";
import { cn } from "@/lib/utils";
import { EASE_PREMIUM } from "@/lib/motion";
import { BlurReveal } from "@/components/animations/blur-reveal";
import { ROLE_COLOR, type RoleId } from "./roles";

/**
 * ServicesConnectionFlow — Bloque 3 "Una solución puede crecer con la otra".
 *
 * Narrativa de modularidad (empezar por una pieza, conectarla después) + un flujo de 4
 * pasos coloreados por rol (web → automatización → IA → tu equipo). Refuerza el sistema
 * sin prometer features técnicas. Content-driven (site.ts). reduced-motion safe; CLS 0.
 */
function ServicesConnectionFlow() {
  const reduce = useReducedMotion() ?? false;
  const { title, body, flow } = servicesConnection;

  return (
    <div className="mt-16 lg:mt-24">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start lg:gap-12">
        {/* Narrativa */}
        <BlurReveal>
          <h3 className="font-heading text-2xl font-bold tracking-tight text-balance sm:text-3xl">
            {title}
          </h3>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-pretty text-muted-foreground sm:text-base">
            {body}
          </p>
        </BlurReveal>

        {/* Flujo de conexión */}
        <motion.ol
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.4 }}
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: reduce ? 0 : 0.1 } },
          }}
          className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-stretch"
        >
          {flow.map((step, i) => {
            const role = ROLE_COLOR[step.role as RoleId] ?? ROLE_COLOR.team;
            const isLast = i === flow.length - 1;
            return (
              <React.Fragment key={step.label}>
                <motion.li
                  variants={{
                    hidden: reduce ? { opacity: 1 } : { opacity: 0, y: 12 },
                    show: {
                      opacity: 1,
                      y: 0,
                      transition: { duration: reduce ? 0 : 0.45, ease: EASE_PREMIUM },
                    },
                  }}
                  className="flex flex-1 items-center gap-3 rounded-xl border border-border/60 bg-background/40 px-4 py-3 backdrop-blur-sm"
                >
                  <span
                    className={cn("size-2 shrink-0 rounded-full", role.dot)}
                    aria-hidden="true"
                  />
                  <span className="text-sm leading-snug font-medium text-foreground/90">
                    {step.label}
                  </span>
                </motion.li>
                {!isLast && (
                  <motion.span
                    aria-hidden="true"
                    variants={{
                      hidden: reduce ? { opacity: 1 } : { opacity: 0 },
                      show: { opacity: 1, transition: { duration: reduce ? 0 : 0.3 } },
                    }}
                    className="flex items-center justify-center self-center text-muted-foreground/50"
                  >
                    <ArrowRight className="size-4 rotate-90 sm:rotate-0" />
                  </motion.span>
                )}
              </React.Fragment>
            );
          })}
        </motion.ol>
      </div>
    </div>
  );
}

export { ServicesConnectionFlow };
