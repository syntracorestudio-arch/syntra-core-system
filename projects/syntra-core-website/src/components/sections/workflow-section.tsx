"use client";

import * as React from "react";
import Image from "next/image";
import { ArrowRight, Check } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

import { siteConfig, workflow, workflowCta } from "@/config/site";
import { EASE_PREMIUM, DURATION } from "@/lib/motion";
import { Section } from "@/components/layout/section";
import { Container } from "@/components/layout/container";
import { SectionHeading } from "@/components/shared/section-heading";
import { BlurReveal } from "@/components/animations/blur-reveal";
import { SectionAtmosphere } from "@/components/marketing/living/section-atmosphere";

/**
 * WorkflowSection — Proceso v2 "Escenario evolutivo" (arquitectura PED, 2026-07-09).
 *
 * Murió la dual-card (cajas gemelas) y la atenuación por opacity (bug de legibilidad).
 * Ahora es un ESCENARIO que evoluciona:
 *  - Desktop (lg+): split sticky. Izquierda = un panel de FOTO enmarcado que hace crossfade
 *    entre las 4 fotos reales según el paso activo + indicador de progreso 01-04. Derecha =
 *    los 4 pasos como TEXTO EDITORIAL sin cajas (PASO · título · body · "Tu parte" · el
 *    RESULTADO como hito dorado). El paso activo lo detecta un IntersectionObserver (scroll
 *    libre, sin hijack); NADIE se atenúa: todos los pasos 100% legibles siempre.
 *  - Mobile (<lg): franjas apiladas, cada paso su foto enmarcada + texto (reveal whileInView).
 *
 * Fondo: SectionAtmosphere (acento dual) — NO se toca. Solo transform/opacity. CLS 0
 * (aspect de foto reservado). Sin cyan (checks/resultado en warm). reduced-motion: swap
 * instantáneo de foto, sin reveals.
 */

/** Warm dorado del resultado (hito) y del paso activo. */
const WARM = "#e7c8a0";
/** Electric del label PASO 0X. */
const ELECTRIC = "#2563eb";
/** Fotos reales del proceso (Unsplash horizontales, aprobadas). Índice = paso. */
const STEP_IMG = [
  "/proceso/proceso-paso-1.jpg",
  "/proceso/proceso-paso-2.jpg",
  "/proceso/proceso-paso-3.jpg",
  "/proceso/proceso-paso-4.jpg",
];
/** Frame compartido de foto (mismo lenguaje que los paneles v5). */
const FRAME =
  "relative overflow-hidden rounded-2xl border border-white/10 shadow-[0_30px_64px_-26px_rgba(0,0,0,0.85)]";

/** Texto editorial de un paso (compartido desktop/mobile). `active` enciende el numeral. */
function StepEditorial({
  item,
  active,
}: {
  item: (typeof workflow)[number];
  active: boolean;
}) {
  return (
    <>
      <span
        className="font-accent text-xs tracking-widest tabular-nums transition-colors"
        style={{ color: active ? WARM : ELECTRIC }}
      >
        PASO {String(item.step).padStart(2, "0")}
      </span>
      <h3 className="mt-2 font-heading text-2xl leading-tight font-bold tracking-tight text-balance sm:text-3xl">
        {item.title}
      </h3>
      <p className="mt-3 text-base leading-relaxed text-pretty text-muted-foreground">
        {item.description}
      </p>
      {item.needFromYou ? (
        <p className="mt-4 text-sm">
          <span className="font-medium text-foreground/70">Tu parte:</span>{" "}
          <span className="text-muted-foreground">{item.needFromYou}</span>
        </p>
      ) : null}

      {/* Resultado = HITO DORADO (sello, no caja): border-l warm + check warm */}
      <div className="mt-5 border-l-2 pl-4" style={{ borderColor: WARM }}>
        <span
          className="font-accent text-[0.7rem] tracking-widest uppercase"
          style={{ color: WARM, opacity: 0.85 }}
        >
          Resultado
        </span>
        <p
          className="mt-1 flex items-center gap-2 text-base font-semibold"
          style={{ color: WARM }}
        >
          <Check className="size-4 shrink-0" strokeWidth={2.4} aria-hidden="true" />
          {item.result}
        </p>
      </div>
    </>
  );
}

function WorkflowSection() {
  const { eyebrow, title, subtitle } = siteConfig.sections.workflow;
  const reduce = useReducedMotion() ?? false;

  // Paso activo (desktop): el crossfade de la foto + el indicador. IntersectionObserver por
  // bloque de paso → setActive en el CALLBACK (handler, no en el body del effect).
  const [active, setActive] = React.useState(0);
  const stepRefs = React.useRef<Array<HTMLDivElement | null>>([]);
  React.useEffect(() => {
    const els = stepRefs.current.filter((el): el is HTMLDivElement => el !== null);
    if (!els.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActive(Number((entry.target as HTMLElement).dataset.step));
          }
        }
      },
      // Línea de activación en el TERCIO SUPERIOR (banda ~2%): el paso se activa
      // recién cuando su bloque LLEGA a la zona de lectura (top cruza ~32% del
      // viewport) — con la banda al centro, el paso siguiente "ganaba" apenas
      // asomaba desde abajo y la foto cambiaba antes de tiempo (feedback owner).
      { rootMargin: "-30% 0px -68% 0px", threshold: 0 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <Section
      id="proceso"
      contained={false}
      // SIN overflow-hidden: rompería el position:sticky del panel de foto (la
      // atmósfera ya se auto-contiene con su propio overflow-hidden).
      className="relative py-16 sm:py-24 lg:py-28"
    >
      {/* === Fondo unificado: atmósfera CSS (acento dual), sin canvas — NO se toca === */}
      <SectionAtmosphere accent="dual" />

      <Container className="relative z-10">
        <BlurReveal>
          <SectionHeading eyebrow={eyebrow} title={title} subtitle={subtitle} />
        </BlurReveal>

        {/* === Desktop (lg+): split sticky — foto (izq) + pasos editoriales (der) === */}
        <div className="mt-14 hidden gap-12 lg:mt-20 lg:grid lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1fr)] lg:items-start">
          {/* Izquierda sticky: foto con crossfade + indicador de progreso */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            <div className={`${FRAME} aspect-[16/10]`}>
              {STEP_IMG.map((src, i) => (
                <motion.div
                  key={src}
                  aria-hidden={active === i ? undefined : true}
                  className="absolute inset-0"
                  initial={false}
                  animate={{ opacity: active === i ? 1 : 0 }}
                  transition={{ duration: reduce ? 0 : 0.5, ease: EASE_PREMIUM }}
                >
                  <Image
                    src={src}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 42vw, 100vw"
                    className="object-cover"
                  />
                </motion.div>
              ))}
              {/* Vignette sutil para dar profundidad al frame */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0"
                style={{ background: "radial-gradient(120% 100% at 50% 0%, transparent 60%, rgba(5,7,12,0.5) 100%)" }}
              />
            </div>

            {/* Indicador de progreso 01-04 (el activo en warm; barra llena hasta el activo) */}
            <div className="mt-5 grid grid-cols-4 gap-2.5">
              {workflow.map((item, i) => (
                <div key={item.step} className="flex items-center gap-2">
                  <span
                    className="font-accent text-[0.7rem] tabular-nums transition-colors"
                    style={{ color: active === i ? WARM : "rgba(148,163,184,0.55)" }}
                  >
                    {String(item.step).padStart(2, "0")}
                  </span>
                  <span
                    className="h-px flex-1 rounded-full transition-colors"
                    style={{
                      backgroundColor: i <= active ? WARM : "rgba(148,163,184,0.22)",
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Derecha: 4 pasos editoriales (todos legibles; el activo enciende su numeral) */}
          <div>
            {workflow.map((item, i) => (
              <div
                key={item.step}
                data-step={i}
                ref={(el) => {
                  stepRefs.current[i] = el;
                }}
                className="border-t border-border/50 py-12 first:border-t-0 first:pt-0 lg:py-16"
              >
                <StepEditorial item={item} active={active === i} />
              </div>
            ))}
          </div>
        </div>

        {/* === Mobile (<lg): franjas apiladas (foto + texto por paso) === */}
        <div className="mt-12 space-y-12 lg:hidden">
          {workflow.map((item, i) => (
            <motion.div
              key={item.step}
              initial={reduce ? { opacity: 1 } : { opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: reduce ? 0 : DURATION.section, ease: EASE_PREMIUM }}
            >
              <div className={`${FRAME} aspect-video`}>
                <Image
                  src={STEP_IMG[i]}
                  alt=""
                  fill
                  sizes="100vw"
                  className="object-cover"
                />
              </div>
              <div className="mt-5">
                <StepEditorial item={item} active={false} />
              </div>
            </motion.div>
          ))}
        </div>

        {/* === Cierre editorial (border-t, sin mega-card) — CTA relacional === */}
        <BlurReveal>
          {/* Sin max-w-5xl por el mismo motivo que el cierre de Servicios: el
              border-t es una línea nítida y centrada a 1024px nacía 32px
              corrida respecto del rail de la sección. */}
          <div className="mt-16 border-t border-border/50 pt-10 lg:mt-20">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between sm:gap-10">
              <div className="max-w-xl">
                <p className="font-heading text-2xl font-bold tracking-tight text-balance sm:text-3xl">
                  {workflowCta.lead}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-pretty text-muted-foreground">
                  {workflowCta.body}
                </p>
              </div>
              <a
                href={workflowCta.href}
                className="group inline-flex shrink-0 items-center gap-2 rounded-xl bg-foreground px-5 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {workflowCta.button}
                <ArrowRight
                  className="size-4 transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </a>
            </div>
          </div>
        </BlurReveal>
      </Container>
    </Section>
  );
}

export { WorkflowSection };
