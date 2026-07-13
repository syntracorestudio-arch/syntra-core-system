"use client";

import * as React from "react";
import Image from "next/image";
import { MotionConfig, motion } from "framer-motion";

import { aboutPillars, aboutStatement, siteConfig } from "@/config/site";
import { EASE_PREMIUM } from "@/lib/motion";
import { Section } from "@/components/layout/section";
import { Container } from "@/components/layout/container";
import { SectionHeading } from "@/components/shared/section-heading";
import { getIcon } from "@/lib/icons";
import { EmberParticles } from "./ember-particles";
import { NosotrosCarousel3D } from "./nosotros-carousel-3d";
import { SpotlightCard } from "./spotlight-card";
import { StatementText } from "./statement-text";
import { PillarVisual, PILLAR_THEME, type PillarId } from "./pillar-visual";

/** Íconos por principio, resueltos a nivel módulo (visual, no copy — no cliché). */
const PILLAR_ICONS = {
  postura: getIcon("Blocks"),
  criterio: getIcon("SlidersHorizontal"),
  cercania: getIcon("MessagesSquare"),
  compromiso: getIcon("Route"),
} as const;

function PillarIcon({ id }: { id: string }) {
  const Icon =
    PILLAR_ICONS[id as keyof typeof PILLAR_ICONS] ?? PILLAR_ICONS.postura;
  return <Icon aria-hidden="true" strokeWidth={1.75} className="size-[18px]" />;
}

/**
 * NosotrosSection — "BRASA" (sección definitiva, lock v3).
 * Vida por CAPAS: imagen atmosférica generada (nebulosa cálida) + brasas en
 * deriva (canvas) + cards premium con spotlight que sigue el mouse + reveals.
 * Grid 2x2 asimétrico (7/5 → 5/7). Statement clímax con SYNTRA en gradiente
 * cálido + subrayado que se enciende. Cero cyan; warm = temperatura de la
 * sección; electric solo interactivo.
 */

const reveal = {
  hidden: { opacity: 0, y: 22, filter: "blur(6px)" },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { delay: 0.1 + i * 0.1, duration: 0.55, ease: EASE_PREMIUM },
  }),
};

function NosotrosSection() {
  const { eyebrow, title, subtitle } = siteConfig.sections.about;

  return (
    <MotionConfig reducedMotion="user">
      <Section
        id="nosotros"
        contained={false}
        className="relative overflow-hidden bg-[#05070c] py-20 lg:py-28"
      >
        {/* Capa 1 — atmósfera generada (nebulosa cálida, Pollinations→optimizada) */}
        <div aria-hidden="true" className="absolute inset-0">
          <Image
            src="/backgrounds/nosotros-atmosphere.jpg"
            alt=""
            fill
            sizes="100vw"
            className="object-cover opacity-75 [mask-image:radial-gradient(ellipse_at_55%_35%,black_38%,transparent_85%)]"
            priority={false}
          />
          {/* Scrim de luminancia: AA del texto en el peor caso */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#05070c]/70 via-transparent to-[#05070c]/80" />
        </div>

        {/* Capa 2 — brasas en deriva lenta (canvas, pausa fuera de viewport) */}
        <EmberParticles />

        <Container className="relative z-10">
          <motion.div
            variants={reveal}
            custom={0}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.4 }}
          >
            <SectionHeading
              align="left"
              eyebrow={eyebrow}
              title={title}
              subtitle={subtitle}
              className="max-w-xl"
            />
          </motion.div>

          {/* PROTOTIPO carrusel cilíndrico 3D (desktop + motion): los 4 principios
              en scroll circular continuo con dwell al frente. Referencia externa
              del owner adaptada al lenguaje SYNTRA. */}
          <div className="mt-6 motion-reduce:hidden lg:mt-8">
            <NosotrosCarousel3D />
          </div>

          {/* Cards premium en columnas ESCALONADAS (mobile + reduced-motion;
              en desktop con motion las reemplaza el carrusel 3D). */}
          <div className="mt-12 grid gap-6 lg:mt-14 lg:hidden lg:grid-cols-2 lg:pb-14 motion-reduce:lg:grid">
            {aboutPillars.map((pillar, i) => {
              const offset = i % 2 === 1;
              return (
                <motion.div
                  key={pillar.id}
                  variants={reveal}
                  custom={i + 1}
                  initial="hidden"
                  whileInView="show"
                  viewport={{ once: true, amount: 0.35 }}
                  className={offset ? "lg:translate-y-14" : undefined}
                >
                  <SpotlightCard
                    className="h-full"
                    glowRgb={PILLAR_THEME[pillar.id as PillarId]?.rgb}
                  >
                    <div className="relative flex h-full flex-col p-6 sm:p-7">
                      {/* Ancla visual: icon-tile con la luz PROPIA del principio */}
                      <div className="flex items-center gap-3">
                        <span
                          className="grid size-10 shrink-0 place-items-center rounded-xl border bg-gradient-to-b from-surface-2/90 to-surface-1/60"
                          style={{
                            color: PILLAR_THEME[pillar.id as PillarId]?.hex,
                            borderColor: `rgba(${PILLAR_THEME[pillar.id as PillarId]?.rgb},0.35)`,
                            boxShadow: `inset 0 1px 0 rgba(248,250,252,0.08), 0 0 22px -6px rgba(${PILLAR_THEME[pillar.id as PillarId]?.rgb},0.55)`,
                          }}
                        >
                          <PillarIcon id={pillar.id} />
                        </span>
                        <span className="font-accent text-[0.65rem] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                          {pillar.ghost}
                        </span>
                      </div>
                      <h3 className="mt-4 font-heading text-xl font-semibold tracking-tight text-foreground sm:text-[1.375rem]">
                        {pillar.title}
                      </h3>
                      {/* Descripción MUTED (nada de blanco pleno en cuerpo) */}
                      <p className="mt-2 max-w-md text-[0.9375rem] leading-relaxed text-muted-foreground">
                        {pillar.description}
                      </p>
                      {/* Pull-quote del principio (mini-manifiesto, copy owner) */}
                      {pillar.stance ? (
                        <p
                          className="mt-3 border-l-2 pl-3 text-[0.8125rem] leading-snug italic"
                          style={{
                            borderColor: `rgba(${PILLAR_THEME[pillar.id as PillarId]?.rgb},0.55)`,
                            color: `rgba(${PILLAR_THEME[pillar.id as PillarId]?.rgb},0.9)`,
                          }}
                        >
                          {pillar.stance}
                        </p>
                      ) : null}
                      {/* Artefacto visual del principio (lo que hace premium la card) */}
                      <PillarVisual id={pillar.id} />
                    </div>
                  </SpotlightCard>
                </motion.div>
              );
            })}
          </div>

          {/* Statement-clímax */}
          <motion.div
            variants={reveal}
            custom={1}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.5 }}
            className="mt-16 text-center lg:mt-20"
          >
            <p className="font-heading text-[2rem] font-semibold leading-tight tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              <StatementText text={aboutStatement} />
            </p>
            <motion.span
              aria-hidden="true"
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.35, ease: EASE_PREMIUM }}
              className="mx-auto mt-6 block h-[2px] w-48 origin-center bg-gradient-to-r from-transparent via-accent-warm/70 to-transparent"
            />
          </motion.div>
        </Container>
      </Section>
    </MotionConfig>
  );
}

export { NosotrosSection };
