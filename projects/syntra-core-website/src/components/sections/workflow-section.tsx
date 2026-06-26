"use client";

import * as React from "react";
import { ArrowRight, Check } from "lucide-react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "framer-motion";

import { siteConfig, workflow, workflowCta, workflowMethodPromise } from "@/config/site";
import { getIcon } from "@/lib/icons";
import { EASE_PREMIUM } from "@/lib/motion";
import { Section } from "@/components/layout/section";
import { Container } from "@/components/layout/container";
import { SectionHeading } from "@/components/shared/section-heading";
import { BlurReveal } from "@/components/animations/blur-reveal";
import { DeferredLivingBackground } from "@/components/marketing/living/deferred-living-background";

/**
 * WorkflowSection — "La Línea Viva" (reference-lock proceso.md, web viva).
 *
 * El proceso ES un camino: un conducto 3D vertical (LivingBackground variant="proceso")
 * con una cresta de luz que baja con el scroll. En el frente, cada estación usa DOS
 * columnas alrededor del nodo central — "qué hacemos" (izq) · "qué recibís"/entregable
 * (der) — y completa ATADA AL SCROLL: PENDIENTE (atenuado) → ACTIVO (foco) → HECHO (check
 * cyan + entregable, que queda). El cable es la bisagra entre acción y resultado. Cierre
 * con CTA relacional. Sin scroll-hijack. reduced-motion → estado final. Solo opacity/
 * transform → CLS 0.
 */

function ProcessStep({
  item,
  index,
  total,
  progress,
  reduce,
}: {
  item: (typeof workflow)[number];
  index: number;
  total: number;
  progress: MotionValue<number>;
  reduce: boolean;
}) {
  // Banda de progreso de este paso (scroll-linked).
  const start = index / total;
  const mid = (index + 0.55) / total;

  const panelOpacity = useTransform(progress, [start - 0.08, start + 0.04], [0.4, 1]);
  // Entrada en stagger ligada al scroll: cada paso "sube" al entrar en foco.
  const panelY = useTransform(progress, [start - 0.08, start + 0.04], [26, 0]);
  const doneOpacity = useTransform(progress, [mid - 0.05, mid], [0, 1]);
  const doneScale = useTransform(progress, [mid - 0.05, mid], [0.85, 1]);
  // Sello HECHO: pop con leve overshoot al completarse.
  const stampScale = useTransform(progress, [mid - 0.05, mid - 0.02, mid], [0.9, 1.06, 1]);
  // Acento ACTIVO: pico que aparece y se va (plateau breve) cuando la cresta llega.
  const activeOpacity = useTransform(
    progress,
    [start, start + 0.05, mid, mid + 0.05],
    [0, 0.85, 0.85, 0],
  );

  const colStyle = reduce ? { opacity: 1 } : { opacity: panelOpacity, y: panelY };
  const done = reduce ? { opacity: 1 } : { opacity: doneOpacity };
  const activeRing = reduce ? { opacity: 0 } : { opacity: activeOpacity };
  const hover = reduce ? undefined : { y: -4 };
  const hoverTransition = { duration: 0.25, ease: EASE_PREMIUM };

  return (
    <div className="relative grid grid-cols-[2.5rem_1fr] gap-x-4 gap-y-4 pb-12 md:grid-cols-[1fr_3.5rem_1fr] md:gap-x-8 md:gap-y-0 md:pb-16">
      {/* Nodo sobre la columna vertebral (col1 mobile, col2/centro desktop) */}
      <div className="col-start-1 row-start-1 flex justify-center md:col-start-2">
        <div className="relative z-10">
          {/* Chip dimensional: bisel (gradiente + luz interior + sombra) → look 3D */}
          <span className="relative flex size-14 items-center justify-center rounded-2xl bg-gradient-to-b from-surface-3 to-surface-1 ring-1 ring-border-strong shadow-[inset_0_1px_0_rgba(255,255,255,0.10),inset_0_-3px_6px_rgba(0,0,0,0.45),0_14px_32px_-14px_rgba(0,0,0,0.75)] backdrop-blur-sm md:size-16">
            {React.createElement(getIcon(item.icon), {
              className: "size-6 md:size-7 text-foreground/75",
              stroke: "url(#proc-icon-grad)",
              "aria-hidden": true,
            })}
            {/* ACTIVO: acento que destella al activarse */}
            <motion.span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-2xl border border-brand-electric/60 bg-brand-electric/10"
              style={activeRing}
            />
            {/* HECHO: check cyan que revela y queda */}
            <motion.span
              className="absolute -top-1.5 -right-1.5 inline-flex size-5 items-center justify-center rounded-full border border-brand-cyan/40 bg-surface-2 text-brand-cyan"
              style={
                reduce
                  ? { opacity: 1, scale: 1 }
                  : { opacity: doneOpacity, scale: doneScale }
              }
            >
              <Check className="size-3" aria-hidden="true" />
            </motion.span>
          </span>
        </div>
      </div>

      {/* Columna IZQUIERDA — "qué hacemos" (panel contenido; mobile col2 row1, desktop col1) */}
      <motion.div
        style={colStyle}
        className="col-start-2 row-start-1 min-w-0 md:col-start-1"
      >
        <motion.div
          whileHover={hover}
          transition={hoverTransition}
          className="relative rounded-2xl border border-border/50 bg-surface-2/45 p-5 backdrop-blur-md transition-colors hover:border-brand-electric/40 md:p-6"
        >
          {/* Énfasis del paso ACTIVO (sincronizado con la cresta del cable) */}
          <motion.span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-brand-electric/50"
            style={activeRing}
          />
          <span className="font-accent text-xs tracking-widest text-muted-foreground">
            PASO {String(item.step).padStart(2, "0")}
          </span>
          <h3 className="mt-1.5 font-heading text-xl font-semibold tracking-tight text-balance sm:text-2xl">
            {item.title}
          </h3>
          <p className="mt-2.5 text-sm leading-relaxed text-pretty text-muted-foreground">
            {item.description}
          </p>
          {item.needFromYou ? (
            <p className="mt-4 flex flex-wrap gap-x-1.5 border-t border-border/40 pt-3 text-xs leading-relaxed">
              <span className="font-medium text-foreground/80">Tu parte:</span>
              <span className="text-muted-foreground">{item.needFromYou}</span>
            </p>
          ) : null}
        </motion.div>
      </motion.div>

      {/* Columna DERECHA — "qué recibís" (panel; mobile col2 row2, desktop col3) */}
      <motion.div
        style={colStyle}
        className="col-start-2 row-start-2 min-w-0 md:col-start-3 md:row-start-1"
      >
        <motion.div
          whileHover={hover}
          transition={hoverTransition}
          className="relative overflow-hidden rounded-2xl border border-border/50 bg-surface-2/45 p-5 backdrop-blur-md transition-colors hover:border-brand-cyan/40 md:p-6"
        >
          {/* Énfasis del paso ACTIVO */}
          <motion.span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-brand-electric/50"
            style={activeRing}
          />
          {/* Acento cyan (HECHO) que revela y queda */}
          <motion.span
            aria-hidden="true"
            className="absolute top-0 left-0 h-full w-0.5 bg-brand-cyan"
            style={done}
          />
          <span className="font-accent text-[0.7rem] tracking-widest text-muted-foreground uppercase">
            Qué recibís
          </span>
          {/* Sello HECHO: pop al completarse */}
          <motion.div
            className="mt-1.5 flex origin-left items-center gap-2.5"
            style={reduce ? { scale: 1 } : { scale: stampScale }}
          >
            <motion.span
              className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-cyan/15 text-brand-cyan"
              style={reduce ? { opacity: 1 } : { opacity: doneOpacity }}
            >
              <Check className="size-3.5" aria-hidden="true" />
            </motion.span>
            <span className="text-base font-semibold text-foreground sm:text-lg">
              {item.result}
            </span>
          </motion.div>
          {item.reassure ? (
            <p className="mt-4 border-t border-border/40 pt-3 text-xs leading-relaxed text-muted-foreground">
              {item.reassure}
            </p>
          ) : null}
        </motion.div>
      </motion.div>
    </div>
  );
}

function WorkflowSection() {
  const { eyebrow, title, subtitle } = siteConfig.sections.workflow;
  const reduce = useReducedMotion() ?? false;
  const total = workflow.length;

  const stepsRef = React.useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: stepsRef,
    offset: ["start center", "end center"],
  });

  return (
    <Section
      id="proceso"
      contained={false}
      className="relative overflow-hidden py-16 sm:py-24 lg:py-28"
    >
      {/* === Fondo full-bleed: base fría + conducto 3D vivo (La Línea Viva) === */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(70% 45% at 50% 0%, #2a2f3a 0%, transparent 55%)," +
              "linear-gradient(180deg, #15171c 0%, #101216 60%, #0d0e12 100%)",
          }}
        />
        <DeferredLivingBackground variant="proceso" />
        <div className="sys-canvas-grid absolute inset-0 opacity-[0.12]" />
      </div>

      {/* Scrim de legibilidad + fundido sup/inf (cose con vecinas), sobre el conducto. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[5]"
        style={{
          background:
            "linear-gradient(180deg, rgba(8,9,12,0.55) 0%, rgba(8,9,12,0.12) 18%, transparent 45%, rgba(8,9,12,0.28) 100%)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[6]"
        style={{
          background:
            "radial-gradient(125% 90% at 50% 50%, transparent 58%, rgba(6,7,9,0.5) 100%)," +
            "linear-gradient(to bottom, rgba(6,7,9,0.9) 0%, transparent 12%, transparent 88%, rgba(6,7,9,0.92) 100%)",
        }}
      />

      {/* Gradiente de marca para el stroke de los íconos de los nodos (electric→cyan). */}
      <svg aria-hidden="true" width="0" height="0" className="absolute">
        <defs>
          <linearGradient id="proc-icon-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#2563eb" />
            <stop offset="100%" stopColor="#38bdf8" />
          </linearGradient>
        </defs>
      </svg>

      <Container className="relative z-10">
        <BlurReveal>
          <SectionHeading eyebrow={eyebrow} title={title} subtitle={subtitle} />
          {/* Micro-promesa de método: enmarca los 4 pasos y da coherencia (no relleno). */}
          <p className="mx-auto mt-4 max-w-xl text-center text-sm leading-relaxed text-pretty text-foreground/70">
            {workflowMethodPromise}
          </p>
        </BlurReveal>

        {/* === Camino vertical de estaciones (dos columnas: qué hacemos · qué recibís) === */}
        <div ref={stepsRef} className="relative mx-auto mt-16 max-w-5xl lg:mt-20">
          {/* Columna vertebral (mobile: rail izq; desktop: centro) que se llena con el scroll */}
          <div
            aria-hidden="true"
            className="absolute top-2 bottom-10 left-5 w-px md:left-1/2 md:-translate-x-1/2"
          >
            <div className="absolute inset-0 bg-border/50" />
            <motion.div
              className="absolute inset-0 origin-top bg-gradient-to-b from-brand-electric/50 via-brand-electric/40 to-brand-cyan/60"
              style={reduce ? { scaleY: 1 } : { scaleY: scrollYProgress }}
            />
          </div>

          {workflow.map((item, i) => (
            <ProcessStep
              key={item.step}
              item={item}
              index={i}
              total={total}
              progress={scrollYProgress}
              reduce={reduce}
            />
          ))}
        </div>

        {/* === Cierre: CTA relacional (arrancar por el paso 1, sin compromiso) === */}
        <BlurReveal>
          <div className="mx-auto mt-6 flex max-w-2xl flex-col items-center gap-5 rounded-2xl border border-border/60 bg-background/40 p-7 text-center backdrop-blur-sm sm:p-9">
            <div className="space-y-2">
              <p className="font-heading text-xl font-semibold tracking-tight text-balance sm:text-2xl">
                {workflowCta.lead}
              </p>
              <p className="mx-auto max-w-md text-sm leading-relaxed text-pretty text-muted-foreground">
                {workflowCta.body}
              </p>
            </div>
            <a
              href={workflowCta.href}
              className="group inline-flex items-center gap-2 rounded-xl bg-foreground px-5 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {workflowCta.button}
              <ArrowRight
                className="size-4 transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </a>
          </div>
        </BlurReveal>
      </Container>
    </Section>
  );
}

export { WorkflowSection };
