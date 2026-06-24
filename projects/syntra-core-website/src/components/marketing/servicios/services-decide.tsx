"use client";

import * as React from "react";
import { ArrowRight } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

import { servicesStart, servicesConsultCta } from "@/config/site";
import { cn } from "@/lib/utils";
import { EASE_PREMIUM, DURATION } from "@/lib/motion";
import { BlurReveal } from "@/components/animations/blur-reveal";
import { ROLE_COLOR, type RoleId } from "./roles";

/**
 * ServicesDecide — Bloques 4 + 5 del cierre de Servicios.
 *
 *  4. "Por dónde te conviene empezar": 3 disparadores de decisión (síntoma → módulo
 *     sugerido) que bajan la fricción de elegir el primer paso.
 *  5. CTA consultivo: para quien no sabe por dónde empezar, sin presión de venta.
 *
 * Content-driven (site.ts). El color de rol va inline (tokens de marca no expresables
 * como clase Tailwind dinámica). Dark-first; reduced-motion safe; CLS 0.
 */
function ServicesDecide() {
  const reduce = useReducedMotion() ?? false;

  return (
    <div className="mt-16 border-t border-border/60 pt-12 lg:mt-20 lg:pt-12">
      {/* Bloque 4 — Por dónde empezar */}
      <BlurReveal>
        <h3 className="max-w-2xl font-heading text-2xl font-bold tracking-tight text-balance sm:text-3xl">
          {servicesStart.title}
        </h3>
      </BlurReveal>

      <motion.div
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.2 }}
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: reduce ? 0 : 0.1, delayChildren: 0.05 } },
        }}
        className="mt-8 grid gap-4 md:grid-cols-3"
      >
        {servicesStart.options.map((option) => {
          const role = ROLE_COLOR[option.serviceId as RoleId] ?? ROLE_COLOR.ia;
          return (
            <motion.div
              key={option.id}
              variants={{
                hidden: reduce ? { opacity: 1 } : { opacity: 0, y: 18, filter: "blur(4px)" },
                show: {
                  opacity: 1,
                  y: 0,
                  filter: "blur(0px)",
                  transition: { duration: reduce ? 0 : DURATION.section, ease: EASE_PREMIUM },
                },
              }}
              className="group relative flex flex-col gap-2 overflow-hidden rounded-2xl border border-border/60 bg-background/40 p-6 backdrop-blur-sm"
            >
              {/* Acento de rol superior */}
              <span
                aria-hidden="true"
                className="absolute inset-x-0 top-0 h-px opacity-70"
                style={{
                  background: `linear-gradient(90deg, transparent, ${role.hex}, transparent)`,
                }}
              />
              <p
                className="text-base leading-snug font-semibold text-balance text-foreground"
              >
                {option.title}
              </p>
              <p className="text-sm leading-relaxed text-pretty text-muted-foreground">
                {option.body}
              </p>
              <span
                className={cn(
                  "mt-1 inline-flex items-center gap-1.5 text-sm font-medium",
                )}
                style={{ color: role.hex }}
              >
                <span
                  className="size-1.5 rounded-full"
                  style={{ backgroundColor: role.hex }}
                  aria-hidden="true"
                />
                Empezar por acá
              </span>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Bloque 5 — CTA consultivo */}
      <BlurReveal>
        <div className="mt-10 flex flex-col items-start gap-5 rounded-2xl border border-border/60 bg-background/40 p-7 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:p-8">
          <div className="max-w-xl">
            <p className="font-heading text-xl font-semibold tracking-tight text-balance sm:text-2xl">
              {servicesConsultCta.question}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-pretty text-muted-foreground">
              {servicesConsultCta.microcopy}
            </p>
          </div>
          <a
            href={servicesConsultCta.href}
            className="group inline-flex shrink-0 items-center gap-2 rounded-xl bg-foreground px-5 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {servicesConsultCta.button}
            <ArrowRight
              className="size-4 transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </a>
        </div>
      </BlurReveal>
    </div>
  );
}

export { ServicesDecide };
