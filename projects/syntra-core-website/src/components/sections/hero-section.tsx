"use client";

import * as React from "react";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { motion, useInView, useReducedMotion, type Variants } from "framer-motion";

import { siteConfig } from "@/config/site";
import { getIcon } from "@/lib/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/layout/section";
import { TrackedLink } from "@/components/shared/tracked-link";
import { EASE_PREMIUM, DURATION } from "@/lib/motion";

/**
 * HeroSection — primera impresión y <h1> único (HERO-REDESIGN, image-first).
 * Protagonista = asset aprobado en el reference-lock (`docs/reference-locks/hero.md`):
 * "Premium Digital Architecture — Estratos Luminosos" (estratos de vidrio/plata,
 * masa a la derecha, espacio negativo a la izquierda). El código COMPONE y ANIMA
 * el asset; NO reinventa un protagonista desde código (sin tubos/waves/glass/3D).
 *
 * Composición: 2 columnas desde lg (texto izquierda sobre el espacio negativo,
 * asset a la derecha sangrando al borde y fundido al fondo). Mobile: asset
 * full-bleed con scrim para legibilidad. H1 estático → LCP rápido; el resto entra
 * en cascada sutil. reduced-motion → estado final inmediato. Signature Palette
 * Exception declarada en el lock (luz/plata dominante; cyan/electric solo filo).
 */

/** Asset protagonista aprobado (reference-lock: A1.1 Estratos Luminosos). */
const HERO_ASSET = "/visual-assets/syntra/hero/hero-stratos.webp";
const HERO_ASSET_ALT =
  "Arquitectura digital de estratos de vidrio y luz — sistema SYNTRA.";

function HeroSection() {
  const { hero, cta } = siteConfig;
  const reduce = useReducedMotion() ?? false;

  // Placa de vidrio (capability rail): el sheen especular solo corre con la placa
  // en viewport (loop pausado fuera de vista) y nunca con reduced-motion.
  const slabRef = React.useRef<HTMLDivElement | null>(null);
  const slabInView = useInView(slabRef, { margin: "-10% 0px" });

  const rise = (i: number): Variants => ({
    hidden: reduce ? { opacity: 1 } : { opacity: 0, y: 16, filter: "blur(6px)" },
    show: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: {
        duration: reduce ? 0 : DURATION.section,
        delay: reduce ? 0 : 0.08 + i * 0.09,
        ease: EASE_PREMIUM,
      },
    },
  });

  return (
    <Section
      id="inicio"
      contained={false}
      className="relative flex items-center overflow-hidden md:min-h-[88svh] lg:min-h-[100svh]"
    >
      {/* === Fondo premium (acompaña, no compite) === */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-20">
        <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_70%_35%,#101c34,#0b1120_62%)]" />
        <div className="absolute top-1/2 right-[8%] size-[44rem] max-w-[90vw] -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(37,99,235,0.14),rgba(96,165,250,0.06)_46%,transparent_70%)] blur-[100px]" />
      </div>

      {/* === Asset protagonista full-bleed (image-first, sin costuras) === */}
      <div className="group pointer-events-none absolute inset-0 -z-10 overflow-hidden [perspective:1400px] lg:pointer-events-auto">
        <motion.div
          initial={reduce ? false : { opacity: 0, scale: 1.04 }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1 }}
          transition={{ duration: reduce ? 0 : DURATION.hero, ease: EASE_PREMIUM }}
          className="absolute inset-0"
        >
          {/* Wrapper 2.5D: profundidad del ASSET COMPLETO en hover (no bloques
              individuales — es imagen plana). Reposo = identidad. */}
          <div className="absolute inset-0 [transform-style:preserve-3d] transition-transform duration-700 ease-out will-change-transform group-hover:[transform:scale(1.02)_translate3d(10px,-7px,0)_rotateX(0.6deg)_rotateY(-1deg)] motion-reduce:transition-none motion-reduce:group-hover:[transform:none]">
            <motion.div
              animate={reduce ? undefined : { y: [0, -16, 0], x: [0, 8, 0] }}
              transition={
                reduce ? undefined : { duration: 13, repeat: Infinity, ease: "easeInOut" }
              }
              className="absolute inset-0"
            >
              <Image
                src={HERO_ASSET}
                alt={HERO_ASSET_ALT}
                fill
                priority
                sizes="100vw"
                // Mobile: foco al CUERPO del vidrio (no al borde derecho, que se ve cortado
                // en aspect angosto). Desktop conserva el encuadre aprobado (72%).
                className="object-cover object-[54%_center] lg:object-[72%_center]"
              />
            </motion.div>
          </div>
        </motion.div>

        {/* Light response al hover: sheen diagonal + glow electric claro sutil (desktop).
            Solo opacity → no lava la imagen, sin costura. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 hidden opacity-0 transition-opacity duration-700 ease-out group-hover:opacity-100 motion-reduce:transition-none lg:block"
        >
          <div className="absolute inset-0 bg-[linear-gradient(115deg,transparent_45%,rgba(150,195,255,0.10)_60%,transparent_72%)]" />
          <div className="absolute top-1/2 right-[20%] size-[26rem] -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(96,165,250,0.12),transparent_66%)] blur-3xl" />
        </div>

        {/* Light sweep cinematográfico (desktop, transform/opacity; sin hard-stop,
            sin lavar la imagen). Banda blanca difusa que cruza muy de vez en cuando. */}
        {!reduce ? (
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 hidden lg:block"
            initial={{ x: "-45%", opacity: 0 }}
            animate={{ x: ["-45%", "145%"], opacity: [0, 0.52, 0] }}
            transition={{
              duration: 9,
              repeat: Infinity,
              repeatDelay: 2.5,
              ease: "easeInOut",
            }}
          >
            <div className="absolute inset-y-0 left-0 w-1/3 -skew-x-12 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.13),transparent)] blur-xl" />
          </motion.div>
        ) : null}

        {/* Scrim de legibilidad: un solo gradiente suave de izq→der, sin hard-stop
            ni borde → no genera línea divisoria. Más fuerte en mobile. */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#0b1120] via-[#0b1120]/82 to-[#0b1120]/10 lg:via-[#0b1120]/45 lg:to-transparent" />
        {/* Fundido inferior para asentar la sección */}
        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#0b1120] to-transparent" />
        {/* Calma suave en la zona baja-izquierda (detrás de bullets/CTAs); radial
            con falloff suave → sin hard-stop ni línea divisoria */}
        <div className="absolute bottom-0 left-0 h-2/3 w-3/4 bg-[radial-gradient(60%_80%_at_18%_92%,rgba(11,17,32,0.55),transparent_72%)]" />
      </div>

      {/* === Contenido === */}
      <div className="pointer-events-none mx-auto grid w-full max-w-6xl items-center gap-10 px-6 lg:max-w-7xl lg:grid-cols-[1.05fr_0.95fr] lg:gap-12 lg:px-8 2xl:max-w-[94rem] 2xl:px-12">
        {/* Columna izquierda: copy / acción / prueba */}
        <div className="pointer-events-auto flex flex-col items-center gap-7 text-center lg:items-start lg:text-left">
          <div className="flex flex-col items-center gap-5 lg:items-start">
            <motion.div variants={rise(0)} initial="hidden" animate="show">
              <Badge
                variant="neutral"
                className="max-w-full text-balance text-center leading-snug whitespace-normal"
              >
                {hero.badge}
              </Badge>
            </motion.div>

            {/* H1: estático, visible desde el SSR (sin gating de hidratación) →
                es el elemento LCP, debe pintarse instantáneo. */}
            <h1 className="font-heading text-4xl leading-[1.08] font-bold tracking-tight text-balance sm:text-5xl xl:text-6xl">
              <span className="lg:block">{hero.titleLead}</span>{" "}
              <span className="lg:block">
                que <span className="text-gradient-brand">{hero.titleHighlight}</span>
              </span>{" "}
              <span className="lg:block">{hero.titleTail}</span>
            </h1>

            <motion.p
              variants={rise(2)}
              initial="hidden"
              animate="show"
              className="max-w-xl text-base leading-relaxed text-foreground/75 text-pretty sm:text-lg"
            >
              {hero.subtitle}
            </motion.p>
          </div>

          {/* CTAs (hover premium: lift sutil + glow controlado, accesible) */}
          <motion.div
            variants={rise(3)}
            initial="hidden"
            animate="show"
            className="flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row"
          >
            <Button
              asChild
              variant="brand"
              size="2xl"
              className="w-full transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_14px_34px_-12px_rgba(37,99,235,0.7)] motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:w-auto"
            >
              <TrackedLink
                href="#contacto"
                trackProps={{ location: "hero", target: "contacto" }}
              >
                {cta.primary}
                <ArrowRight data-icon="inline-end" />
              </TrackedLink>
            </Button>
            <Button
              asChild
              variant="brand-outline"
              size="2xl"
              className="w-full transition-[transform,border-color,background-color] duration-200 ease-out hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:w-auto"
            >
              <TrackedLink
                href="#casos"
                trackProps={{ location: "hero", target: "casos" }}
              >
                {cta.secondary}
              </TrackedLink>
            </Button>
          </motion.div>

          {/* Placa de vidrio (capability rail v2): UN objeto monolítico — un estrato
              extraído del edificio del asset. Segmentos separados por costuras de luz
              (no cajas), canto superior iluminado, sheen especular lento (mismo
              lenguaje que el light sweep del asset) y cola de fusión hacia el
              edificio en lg. Solo transform/opacity → CLS 0, LCP intacto. */}
          <motion.div
            variants={rise(4)}
            initial="hidden"
            animate="show"
            className="relative w-full max-w-md lg:max-w-xl"
          >
            <div
              ref={slabRef}
              className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.07] via-white/[0.04] to-white/[0.02] shadow-[0_24px_60px_-28px_rgba(0,0,0,0.75)] backdrop-blur-md"
            >
              {/* Canto superior iluminado (el filo del estrato) */}
              <div
                aria-hidden="true"
                className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/45 to-transparent"
              />
              {/* Base interna: gradiente frío que asienta la placa contra el scrim */}
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-[radial-gradient(120%_150%_at_85%_-20%,rgba(96,165,250,0.10),transparent_60%)]"
              />

              {/* Sheen especular lento (pausado fuera de viewport; nunca con reduce) */}
              {!reduce ? (
                <motion.div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0"
                  initial={{ x: "-70%" }}
                  animate={slabInView ? { x: ["-70%", "170%"] } : { x: "-70%" }}
                  transition={
                    slabInView
                      ? { duration: 2.8, repeat: Infinity, repeatDelay: 7, ease: "easeInOut", delay: 1.2 }
                      : { duration: 0 }
                  }
                >
                  <div className="absolute inset-y-0 left-0 w-1/3 -skew-x-12 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.10),transparent)]" />
                </motion.div>
              ) : null}

              <div className="relative grid sm:grid-cols-3">
                {hero.capabilities.map((cap) => {
                  const Icon = getIcon(cap.icon);
                  return (
                    <div
                      key={cap.title}
                      className="group relative p-5 text-left transition-colors duration-300 ease-out before:absolute before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent before:transition-opacity first:before:hidden hover:bg-white/[0.05] before:inset-x-5 before:top-0 before:h-px sm:before:inset-x-auto sm:before:inset-y-4 sm:before:left-0 sm:before:h-auto sm:before:w-px sm:before:bg-gradient-to-b sm:hover:before:via-[#60a5fa]/60"
                    >
                      <Icon
                        className="size-5 text-[#60a5fa] transition-colors duration-300 ease-out group-hover:text-[#e7c8a0]"
                        aria-hidden="true"
                      />
                      <p className="mt-2.5 text-base font-semibold text-foreground">
                        {cap.title}
                      </p>
                      <p className="mt-1 text-sm leading-snug text-muted-foreground">
                        {cap.copy}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Cola de fusión: la placa se funde hacia la zona del asset (solo lg) */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute top-0 bottom-0 left-full hidden w-44 lg:block"
              style={{
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.015))",
                maskImage: "linear-gradient(90deg, black, transparent 88%)",
                WebkitMaskImage: "linear-gradient(90deg, black, transparent 88%)",
              }}
            />
          </motion.div>
        </div>

        {/* Columna derecha: vacía a propósito; el asset vive en el fondo a la derecha */}
        <div className="hidden lg:block" aria-hidden="true" />
      </div>
    </Section>
  );
}

export { HeroSection };
