"use client";

import * as React from "react";
import { ArrowRight, Check } from "lucide-react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import dynamic from "next/dynamic";

import { services, servicesConnector, siteConfig } from "@/config/site";
import { getIcon } from "@/lib/icons";
import { EASE_PREMIUM, DURATION } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { Section } from "@/components/layout/section";
import { Container } from "@/components/layout/container";
import { SectionHeading } from "@/components/shared/section-heading";
import { BlurReveal } from "@/components/animations/blur-reveal";
import { MagicCard } from "@/components/ui/magic-card";
import { BorderBeam } from "@/components/ui/border-beam";

// PROTOTIPO web viva: fondo 3D ambiental, lazy (sin SSR, no bloquea LCP).
const LivingBackground = dynamic(
  () =>
    import("@/components/marketing/living/living-background").then(
      (m) => m.LivingBackground,
    ),
  { ssr: false },
);

/**
 * ServicesSection — PROTOTIPO web viva (piloto).
 *
 * Tres puertas como CARDS PREMIUM (MagicCard spotlight + BorderBeam por rol) sobre el
 * fondo vivo 3D. Contenido interior más rico (tag · título · descripción · entregables
 * con check · CTA) sin tocar el copy de site.ts. Identidad por rol
 * (electric/violeta/cyan). reduced-motion safe; CLS 0.
 *
 * Estado: prototipo para aprobar el objetivo visual del lock (Servicios). No commitear
 * hasta OK del owner (visual gate).
 */

interface Role {
  idx: string;
  /** color sólido del rol (hex) para spotlight + beam */
  hex: string;
  hex2: string;
  text: string; // clase de texto del rol
  tint: string; // bg tint del ícono
  ring: string; // borde del chip de ícono
}

const ROLES: Record<string, Role> = {
  web: {
    idx: "01",
    hex: "#2563eb",
    hex2: "#38bdf8",
    text: "text-brand-electric",
    tint: "bg-brand-electric/10",
    ring: "ring-brand-electric/25",
  },
  automation: {
    idx: "02",
    hex: "#6d5dfb",
    hex2: "#2563eb",
    text: "text-accent-ai",
    tint: "bg-accent-ai/10",
    ring: "ring-accent-ai/25",
  },
  ia: {
    idx: "03",
    hex: "#38bdf8",
    hex2: "#6d5dfb",
    text: "text-brand-cyan",
    tint: "bg-brand-cyan/10",
    ring: "ring-brand-cyan/25",
  },
};

const FALLBACK: Role = ROLES.ia;

function ServicesSection() {
  const { eyebrow, title, subtitle } = siteConfig.sections.services;
  const reduce = useReducedMotion() ?? false;

  const grid: Variants = {
    hidden: {},
    show: {
      transition: { staggerChildren: reduce ? 0 : 0.12, delayChildren: reduce ? 0 : 0.05 },
    },
  };
  const card: Variants = {
    hidden: reduce ? { opacity: 1 } : { opacity: 0, y: 26, filter: "blur(6px)" },
    show: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: { duration: reduce ? 0 : DURATION.section, ease: EASE_PREMIUM },
    },
  };

  return (
    <Section id="servicios" contained={false} className="relative overflow-hidden">
      {/* === Fondo full-bleed: base gris ahumado + arco 3D vivo (debajo del contenido) === */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(75% 60% at 78% 8%, #3a3e47 0%, transparent 55%)," +
              "linear-gradient(180deg, #1b1d22 0%, #121317 60%, #0e0f12 100%)",
          }}
        />
        <LivingBackground />
        <div className="sys-canvas-grid absolute inset-0 opacity-20" />
      </div>

      <Container className="relative z-10">
        <BlurReveal>
          <SectionHeading eyebrow={eyebrow} title={title} subtitle={subtitle} align="left" />
        </BlurReveal>

      {/* === Tres puertas: cards premium === */}
      <motion.div
        variants={grid}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.2 }}
        className="mx-auto mt-14 grid max-w-5xl gap-5 lg:mt-20 lg:grid-cols-3 lg:gap-6"
      >
        {services.map((service) => {
          const Icon = getIcon(service.icon);
          const role = ROLES[service.id] ?? FALLBACK;

          return (
            <motion.div
              key={service.id}
              variants={card}
              whileHover={reduce ? undefined : { y: -6 }}
              transition={{ duration: 0.3, ease: EASE_PREMIUM }}
              className="h-full"
            >
              <MagicCard
                gradientColor={role.hex}
                gradientOpacity={0.14}
                gradientFrom={role.hex}
                gradientTo={role.hex2}
                gradientSize={260}
                className="h-full rounded-2xl"
              >
                <div className="relative flex h-full flex-col gap-4 p-6">
                  {/* Top: ícono de rol + índice */}
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        "inline-flex size-10 items-center justify-center rounded-xl ring-1",
                        role.tint,
                        role.ring,
                      )}
                    >
                      <Icon className={cn("size-5", role.text)} aria-hidden="true" />
                    </span>
                    <span
                      className={cn(
                        "font-heading text-2xl font-bold tracking-tighter tabular-nums opacity-25",
                        role.text,
                      )}
                    >
                      {role.idx}
                    </span>
                  </div>

                  {/* Tag */}
                  <span className={cn("font-accent text-xs tracking-widest uppercase", role.text)}>
                    {service.tag}
                  </span>

                  {/* Título + descripción */}
                  <div className="space-y-3">
                    <h3 className="font-heading text-2xl leading-tight font-bold tracking-tight text-balance">
                      {service.title}
                    </h3>
                    <p className="text-sm leading-relaxed text-pretty text-muted-foreground">
                      {service.description}
                    </p>
                  </div>

                  {/* Entregables (copy existente, presentación más rica) */}
                  <ul className="mt-1 space-y-2">
                    {service.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2.5 text-sm text-foreground/85">
                        <Check className={cn("mt-0.5 size-4 shrink-0", role.text)} aria-hidden="true" />
                        <span className="leading-snug">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA al pie */}
                  <a
                    href="#contacto"
                    className={cn(
                      "mt-auto inline-flex items-center gap-1.5 pt-2 text-sm font-medium transition-opacity hover:opacity-80",
                      role.text,
                    )}
                  >
                    Lo quiero para mi negocio
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </a>
                </div>

                {!reduce && (
                  <BorderBeam
                    size={130}
                    duration={9}
                    colorFrom={role.hex}
                    colorTo={role.hex2}
                    className="opacity-70"
                  />
                )}
              </MagicCard>
            </motion.div>
          );
        })}
      </motion.div>

      {/* === Cierre: modularidad (empezá por una, conectá todo) === */}
      <BlurReveal>
        <div className="mt-16 flex flex-col items-start gap-3 border-t border-border/60 pt-8 lg:mt-20 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
          <p className="max-w-2xl font-heading text-xl font-semibold tracking-tight text-balance sm:text-2xl">
            {servicesConnector.title}
          </p>
          <p className="max-w-md text-sm leading-relaxed text-pretty text-muted-foreground">
            {servicesConnector.body}
          </p>
        </div>
      </BlurReveal>
      </Container>
    </Section>
  );
}

export { ServicesSection };
