"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Check, Plus } from "lucide-react";
import {
  MotionConfig,
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";

import { faqs, faqRail, siteConfig } from "@/config/site";
import { EASE_PREMIUM } from "@/lib/motion";
import { Section } from "@/components/layout/section";
import { Container } from "@/components/layout/container";
import { SectionHeading } from "@/components/shared/section-heading";
import { Button } from "@/components/ui/button";
import { EmberParticles } from "@/components/marketing/aplicaciones/nosotros/ember-particles";

/**
 * FaqSection — "PUENTE TÉRMICO" (rediseño 2026-07-06, dirección Termoclina).
 * FAQ = la transición térmica del recorrido: entra en el calor residual de
 * Nosotros (brasas) y sale hacia el campo eléctrico de Contacto.
 *
 *  · FONDO VIVO: calor warm arriba que SE RETIRA con el scroll (la sección se
 *    enfría) + campo electric respirando abajo + rescoldo térmico de partículas
 *    (EmberParticles thermal: viran warm→electric por altura) + grano.
 *  · LAYOUT: split asimétrico — rail izquierdo sticky (heading + termómetro
 *    vivo + micro-CTA a Contacto) + items en columna derecha.
 *  · ITEM: número índice + BARRA TÉRMICA warm→electric que se enciende al
 *    abrir + indicador "+"→"×" + glow del color interpolado de su posición
 *    (item 1 = warm … item 7 = electric). Leída = tick WARM dorado persistente
 *    (duda resuelta = HECHO → warm #e7c8a0; sweep de color 2026-07-09).
 *  · Apertura con grid-rows (CSS puro, sin medir alturas, user-initiated → CLS 0).
 * reduced-motion: MotionConfig user + canvas apagado + frontera a media altura.
 */

const WARM = [231, 200, 160] as const;
const ELECTRIC = [37, 99, 235] as const;

/** Interpola warm→electric según la posición del item (0..1). */
function thermalRgb(k: number): string {
  const r = Math.round(WARM[0] + (ELECTRIC[0] - WARM[0]) * k);
  const g = Math.round(WARM[1] + (ELECTRIC[1] - WARM[1]) * k);
  const b = Math.round(WARM[2] + (ELECTRIC[2] - WARM[2]) * k);
  return `${r},${g},${b}`;
}

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")";

const reveal = {
  hidden: { opacity: 0, y: 22, filter: "blur(6px)" },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { delay: 0.08 + i * 0.07, duration: 0.5, ease: EASE_PREMIUM },
  }),
};

/**
 * Micro-CTA a Contacto — versión llamativa (feedback owner): pill electric
 * con gradiente, SHIMMER que la recorre cada pocos segundos, glow que respira
 * y flecha que avanza al hover. Electric = interactivo (regla de paleta).
 */
function FaqCta() {
  return (
    <motion.div
      animate={{
        boxShadow: [
          "0 0 14px -4px rgba(37,99,235,0.25)",
          "0 0 34px -4px rgba(37,99,235,0.6)",
          "0 0 14px -4px rgba(37,99,235,0.25)",
        ],
      }}
      transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }}
      className="inline-flex rounded-full"
    >
      <Button
        asChild
        // max-lg:h-11 → 44px en táctil (el size default deja 32px y este es el
        // único CTA de la sección en mobile). Desktop conserva su calibrado.
        className="group relative overflow-hidden border-0 bg-gradient-to-r from-[#2563eb] to-[#3b82f6] text-white transition-transform duration-300 max-lg:h-11 max-lg:px-5 hover:scale-[1.03] hover:from-[#2f6ff0] hover:to-[#4c8dff]"
      >
        <Link href={faqRail.ctaHref}>
          {/* Shimmer: banda de luz que recorre el botón (llama sin gritar) */}
          <motion.span
            aria-hidden="true"
            initial={{ left: "-40%" }}
            animate={{ left: ["-40%", "140%"] }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              repeatDelay: 2.4,
              ease: "easeInOut",
            }}
            className="absolute inset-y-0 w-1/3 -skew-x-12 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.28),transparent)]"
          />
          <span className="relative">{faqRail.ctaButton}</span>
          <ArrowRight
            aria-hidden="true"
            className="relative size-4 transition-transform duration-300 group-hover:translate-x-1"
          />
        </Link>
      </Button>
    </motion.div>
  );
}

function FaqSection() {
  const { eyebrow, title, subtitle } = siteConfig.sections.faq;
  const reduce = useReducedMotion() ?? false;

  const [open, setOpen] = React.useState<number | null>(null);
  const [resolved, setResolved] = React.useState<ReadonlySet<number>>(
    () => new Set<number>(),
  );

  const toggle = (i: number) => {
    setOpen((prev) => (prev === i ? null : i));
    setResolved((prev) => {
      if (prev.has(i)) return prev;
      const next = new Set(prev);
      next.add(i);
      return next;
    });
  };

  // La frontera térmica se desplaza con el scroll: el calor se retira hacia
  // arriba a medida que se recorre la sección (scroll-LINKED, no scrub de steps).
  const sectionRef = React.useRef<HTMLElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });
  const warmTop = useTransform(scrollYProgress, [0, 1], ["-6%", "-42%"]);
  const thermoFill = useTransform(scrollYProgress, [0.1, 0.75], [0.12, 1]);
  // Altura del relleno + posición del cabezal luminoso del termómetro.
  const thermoHeight = useTransform(thermoFill, (v) => `${Math.round(Math.min(Math.max(v, 0), 1) * 100)}%`);

  return (
    <MotionConfig reducedMotion="user">
      <Section
        id="faq"
        contained={false}
        ref={sectionRef}
        className="relative overflow-hidden bg-[#05070c] py-24 lg:py-32"
      >
        {/* === Fondo vivo: el puente térmico === */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          {/* Base alineada con las vecinas: arranca EXACTO en el #05070c de
              Nosotros y ATERRIZA en el tono del backdrop de Contacto
              (#0b0f18→#06070d) — sin salto de división. */}
          <div className="absolute inset-0 bg-[linear-gradient(180deg,#05070c_0%,#070b15_58%,#090d16_100%)]" />
          {/* Campo estelar de la casa (mismas capas atmo-* que SectionAtmosphere): mata el
              "frame plano" y cose FAQ con el resto de la película. La termoclina de abajo ya
              aporta los blobs warm/electric respirando, así que acá solo va el stardust. */}
          <div className="atmo-stars atmo-stars-a" />
          <div className="atmo-stars atmo-stars-b" />
          {/* Banda de entrega: los últimos px se funden al color exacto con el
              que abre el backdrop de Contacto. */}
          <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-b from-transparent via-[#080c14]/60 to-[#070a11]" />
          {/* Calor residual de Nosotros (se RETIRA con el scroll + deriva leve) */}
          <motion.div
            style={reduce ? { top: "-20%" } : { top: warmTop }}
            className="absolute inset-x-0 h-[55%]"
          >
            <motion.div
              animate={reduce ? undefined : { x: [0, -26, 0] }}
              transition={reduce ? undefined : { duration: 19, repeat: Infinity, ease: "easeInOut" }}
              className="size-full bg-[radial-gradient(70%_80%_at_22%_0%,rgba(231,200,160,0.10),transparent_65%)]"
            />
          </motion.div>
          {/* Campo electric respirando abajo (anticipa Contacto) + deriva lateral */}
          <motion.div
            animate={
              reduce
                ? undefined
                : { scale: [1, 1.07, 1], opacity: [0.8, 1, 0.8], x: [0, 30, 0] }
            }
            transition={reduce ? undefined : { duration: 11, repeat: Infinity, ease: "easeInOut" }}
            className="absolute inset-x-0 bottom-[-18%] h-[52%]"
          >
            <div className="size-full bg-[radial-gradient(65%_85%_at_62%_100%,rgba(37,99,235,0.13),rgba(59,130,246,0.04)_55%,transparent_78%)]" />
          </motion.div>
          {/* Rescoldo térmico: partículas warm→electric por altura, baja densidad,
              sesgadas al flanco del rail (nunca detrás de las respuestas) */}
          <div className="absolute inset-0 [mask-image:radial-gradient(ellipse_at_18%_40%,black_28%,transparent_72%)]">
            <EmberParticles thermal densityDivisor={60000} />
          </div>
          {/* Grano (materia, anti-banding) */}
          <div
            className="absolute inset-0 opacity-[0.05] mix-blend-overlay"
            style={{ backgroundImage: GRAIN }}
          />
        </div>

        <Container className="relative z-10">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:gap-16">
            {/* === Rail izquierdo (sticky): heading + termómetro + micro-CTA === */}
            <motion.div
              variants={reveal}
              custom={0}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.3 }}
              className="reveal-blur lg:sticky lg:top-28 lg:self-start"
            >
              {/* Título un escalón más grande (rail con aire de sobra) */}
              <SectionHeading
                align="left"
                eyebrow={eyebrow}
                title={title}
                subtitle={subtitle}
                className="[&_h2]:text-4xl [&_h2]:leading-[1.08] sm:[&_h2]:text-[2.75rem]"
              />

              {/* Termómetro térmico vivo: se carga con el scroll de la sección,
                  con cabezal luminoso que marca la "temperatura" actual. */}
              <div className="mt-8 hidden items-center gap-4 lg:flex">
                <div className="relative h-32 w-[3px] rounded-full bg-border/60">
                  <motion.span
                    style={reduce ? { height: "50%" } : { height: thermoHeight }}
                    className="absolute inset-x-0 top-0 overflow-hidden rounded-full bg-gradient-to-b from-accent-warm via-accent-warm/60 to-accent-primary"
                  />
                  {/* Cabezal: punto electric con glow que viaja con el relleno */}
                  <motion.span
                    style={reduce ? { top: "50%" } : { top: thermoHeight }}
                    className="absolute left-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-primary shadow-[0_0_14px_2px_rgba(37,99,235,0.55)]"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <p className="text-sm text-smoke-2">{faqRail.microcopy}</p>
                  {/* Contador de dudas resueltas (warm dorado = HECHO, semántico);
                      pop sutil en cada cambio. */}
                  <motion.p
                    key={resolved.size}
                    initial={{ scale: 1.12, opacity: 0.5 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.35, ease: EASE_PREMIUM }}
                    aria-live="polite"
                    className={`font-accent text-[0.7rem] uppercase tracking-[0.18em] ${
                      resolved.size > 0 ? "text-accent-warm/80" : "text-muted-foreground/50"
                    }`}
                  >
                    {resolved.size > 0
                      ? `${resolved.size} de ${faqs.length} leídas`
                      : `${faqs.length} preguntas`}
                  </motion.p>
                </div>
              </div>

              {/* Micro-CTA hacia Contacto (desktop: en el rail) */}
              <div className="mt-8 hidden flex-col items-start gap-3 lg:flex">
                <p className="text-sm text-muted-foreground">{faqRail.ctaQuestion}</p>
                <FaqCta />
              </div>
            </motion.div>

            {/* === Columna de items térmicos === */}
            <div className="flex flex-col gap-3">
              {faqs.map((faq, i) => {
                const k = faqs.length > 1 ? i / (faqs.length - 1) : 0;
                const rgb = thermalRgb(k);
                const isOpen = open === i;
                const isResolved = resolved.has(i);
                return (
                  <motion.div
                    key={faq.question}
                    variants={reveal}
                    custom={i + 1}
                    initial="hidden"
                    whileInView="show"
                    viewport={{ once: true, amount: 0.25 }}
                    className="reveal-blur"
                  >
                    <div
                      className="group relative overflow-hidden rounded-2xl border bg-surface-1/90 transition-all duration-300"
                      style={{
                        borderColor: isOpen
                          ? `rgba(${rgb},0.45)`
                          : "var(--border)",
                        boxShadow: isOpen
                          ? `0 0 44px -14px rgba(${rgb},0.4)`
                          : "none",
                      }}
                    >
                      {/* Barra térmica: se enciende al abrir (el puente en 2px) */}
                      <span
                        aria-hidden="true"
                        className={`absolute left-0 top-0 h-full w-[2px] origin-top bg-gradient-to-b from-accent-warm/80 to-accent-primary/80 transition-transform duration-500 ease-out ${
                          isOpen ? "scale-y-100" : "scale-y-0"
                        }`}
                      />

                      <button
                        type="button"
                        aria-expanded={isOpen}
                        onClick={() => toggle(i)}
                        className="flex w-full cursor-pointer items-center gap-4 px-5 py-4 text-left sm:px-6 sm:py-5"
                      >
                        {/* Índice + tick warm dorado persistente al haberla leído */}
                        <span className="relative flex w-8 shrink-0 items-center gap-1">
                          <span
                            className="font-accent text-xs tracking-[0.18em] tabular-nums transition-colors duration-300"
                            style={{
                              color: isOpen
                                ? `rgb(${rgb})`
                                : "var(--muted-foreground)",
                            }}
                          >
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          {isResolved && !isOpen && (
                            <Check
                              aria-hidden="true"
                              className="size-3 text-accent-warm/80"
                              strokeWidth={2.5}
                            />
                          )}
                        </span>

                        <span
                          className={`flex-1 font-medium transition-colors duration-300 ${
                            isOpen ? "text-foreground" : "text-foreground/90"
                          }`}
                        >
                          {faq.question}
                        </span>

                        {/* Indicador +→× (tile, electric solo interactivo) */}
                        <span
                          className="grid size-8 shrink-0 place-items-center rounded-lg border border-border-strong/50 bg-surface-2/60 transition-colors duration-300 group-hover:border-accent-primary/40"
                          aria-hidden="true"
                        >
                          <Plus
                            className={`size-4 transition-transform duration-300 ${
                              isOpen
                                ? "rotate-45 text-accent-primary"
                                : "text-muted-foreground group-hover:text-accent-primary"
                            }`}
                          />
                        </span>
                      </button>

                      {/* Respuesta: apertura grid-rows (CSS puro, CLS-safe) */}
                      <div
                        className={`grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${
                          isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                        }`}
                      >
                        <div className="min-h-0 overflow-hidden">
                          {/* La respuesta entra con fade+rise leve tras la apertura */}
                          <p
                            className={`max-w-prose px-5 pb-5 pl-[4.25rem] text-[0.9375rem] leading-relaxed text-muted-foreground transition-all delay-100 duration-300 sm:px-6 sm:pl-[4.5rem] motion-reduce:transition-none ${
                              isOpen ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0"
                            }`}
                          >
                            {faq.answer}
                          </p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}

              {/* Micro-CTA (mobile: al pie del stack) */}
              <div className="mt-6 flex flex-col items-center gap-3 lg:hidden">
                <p className="text-sm text-muted-foreground">{faqRail.ctaQuestion}</p>
                <FaqCta />
              </div>
            </div>
          </div>
        </Container>
      </Section>
    </MotionConfig>
  );
}

export { FaqSection };
