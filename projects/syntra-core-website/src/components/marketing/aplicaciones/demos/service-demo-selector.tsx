"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Info } from "lucide-react";

import { applicationsNote, serviceDemos } from "@/config/site";
import { getIcon } from "@/lib/icons";
import { EASE_PREMIUM, DURATION } from "@/lib/motion";
import { DEMO_ACCENT, type DemoAccentId } from "./demo-shared";
import { DemoLanding } from "./demo-landing";
import { DemoChat } from "./demo-chat";
import { DemoAutomation } from "./demo-automation";
import { DemoDashboard } from "./demo-dashboard";

/**
 * ServiceDemoSelector — Casos v2 "Lo que construimos, funcionando".
 * Tabs por TIPO DE SOLUCIÓN (orden pipeline: landing → asistente →
 * automatización → panel) + split invertido: el ARTEFACTO VIVO es protagonista
 * (~58%, con glow del acento del demo activo) y el rail editorial acompaña
 * (lead, tagline, description, flow de 4 pasos, nota de honestidad).
 * Solo la demo activa corre su loop (AnimatePresence desmonta la anterior →
 * cleanup de timers en useDemoLoop). min-height reservado → CLS 0.
 */

const DEMO_BY_ID: Record<string, React.ComponentType<{ reduce: boolean }>> = {
  landing: DemoLanding,
  asistente: DemoChat,
  automatizacion: DemoAutomation,
  panel: DemoDashboard,
};

// Íconos resueltos a nivel módulo (regla static-components).
const TAB_ICONS = serviceDemos.map((d) => getIcon(d.icon));

function ServiceDemoSelector() {
  const reduce = useReducedMotion() ?? false;
  const [activeId, setActiveId] = React.useState<string>(serviceDemos[0].id);
  const active = serviceDemos.find((d) => d.id === activeId) ?? serviceDemos[0];
  const accent = DEMO_ACCENT[active.id as DemoAccentId] ?? DEMO_ACCENT.landing;
  const ActiveDemo = DEMO_BY_ID[active.id] ?? DemoLanding;

  return (
    <div className="mt-12 lg:mt-14">
      {/* Tabs pill (orden pipeline) */}
      {/* Scroller horizontal solo donde la fila no entra ni de casualidad
          (≤640). Desde md las 4 pills miden 730px contra 720px de ancho útil:
          se cortaba "Panel de gestión" por 10px y parecía un bug, no un
          carrusel. Envolviendo entran completas (auditoría 2026-07-22). */}
      {/* Abajo de md la fila no entra (730px de pills contra 342 útiles en un
          teléfono) y scrollea. El fundido del borde derecho es la SEÑAL de que
          hay más: sin él la última pill se ve cortada y parece un bug, no un
          carrusel — que es exactamente como lo leyó el owner en su celular. Se
          apaga desde md, donde las pills envuelven y no hay nada oculto. */}
      <div
        role="tablist"
        aria-label="Ejemplos del servicio"
        className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [mask-image:linear-gradient(to_right,black_calc(100%-2.5rem),transparent)] [&::-webkit-scrollbar]:hidden md:flex-wrap md:justify-center md:overflow-visible md:[mask-image:none]"
      >
        {serviceDemos.map((demo, i) => {
          const Icon = TAB_ICONS[i];
          const isActive = demo.id === activeId;
          const a = DEMO_ACCENT[demo.id as DemoAccentId] ?? DEMO_ACCENT.landing;
          return (
            <button
              key={demo.id}
              role="tab"
              id={`demo-tab-${demo.id}`}
              aria-selected={isActive}
              aria-controls={`demo-panel-${demo.id}`}
              onClick={() => setActiveId(demo.id)}
              className="flex shrink-0 cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all duration-300 max-lg:py-2.5"
              style={
                isActive
                  ? {
                      borderColor: `rgba(${a.rgb},0.55)`,
                      background: `rgba(${a.rgb},0.10)`,
                      color: "var(--foreground)",
                      boxShadow: `0 0 24px -8px rgba(${a.rgb},0.55)`,
                    }
                  : {
                      borderColor: "var(--border)",
                      color: "var(--muted-foreground)",
                    }
              }
            >
              <Icon
                aria-hidden="true"
                className="size-4"
                style={isActive ? { color: a.hex } : undefined}
              />
              {demo.pill}
            </button>
          );
        })}
      </div>

      {/* Split invertido: artefacto protagonista + rail editorial */}
      <div className="mt-8 grid items-center gap-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-14">
        {/* Artefacto (min-height reservado → CLS 0 entre demos) */}
        <div
          id={`demo-panel-${active.id}`}
          role="tabpanel"
          aria-labelledby={`demo-tab-${active.id}`}
          /* min-w-0: un ítem de grilla arranca con min-width:auto, o sea que su
             contenido lo puede ensanchar por encima de la columna. La demo de
             Automatización hacía exactamente eso — medía 422px dentro de un
             contenedor de 342px y la sección se la comía por el borde derecho.
             Esto es el cinturón: aunque una demo futura crezca, no empuja. */
          className="relative min-h-[26rem] min-w-0 lg:min-h-[27rem]"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={active.id}
              initial={reduce ? { opacity: 1 } : { opacity: 0, y: 18, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -12, filter: "blur(4px)" }}
              transition={{ duration: DURATION.standard, ease: EASE_PREMIUM }}
              className="reveal-blur flex min-h-[26rem] items-center lg:min-h-[27rem]"
            >
              <ActiveDemo reduce={reduce} />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Rail editorial */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={active.id}
            initial={reduce ? { opacity: 1 } : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: DURATION.standard, ease: EASE_PREMIUM, delay: 0.06 }}
            className="flex flex-col gap-4"
          >
            <h3 className="font-heading text-2xl font-semibold tracking-tight text-foreground text-balance sm:text-[1.7rem]">
              {active.lead}
            </h3>
            <p className="text-sm font-medium" style={{ color: accent.hex }}>
              {active.tagline}
            </p>
            <p className="text-[0.9375rem] leading-relaxed text-muted-foreground">
              {active.description}
            </p>

            {/* Flow de 4 pasos (el 4º = resultado, cyan) */}
            <ol className="mt-1 flex flex-col gap-2.5">
              {active.flow.map((paso, i) => {
                const isDone = i === active.flow.length - 1;
                return (
                  <li key={paso} className="flex items-center gap-3">
                    <span
                      className="grid size-6 shrink-0 place-items-center rounded-full border font-accent text-[0.65rem] tabular-nums"
                      style={
                        isDone
                          ? {
                              borderColor: "rgba(231,200,160,0.5)",
                              background: "rgba(231,200,160,0.1)",
                              color: "#e7c8a0",
                            }
                          : {
                              borderColor: `rgba(${accent.rgb},0.35)`,
                              color: `rgba(${accent.rgb},0.9)`,
                            }
                      }
                    >
                      {i + 1}
                    </span>
                    <span
                      className={`text-sm ${isDone ? "font-medium text-foreground" : "text-smoke-2"}`}
                    >
                      {paso}
                    </span>
                  </li>
                );
              })}
            </ol>

            {/* Nota de honestidad (los sistemas son reales) */}
            <p className="mt-2 flex items-start gap-2 border-t border-border/60 pt-4 text-xs leading-relaxed text-muted-foreground">
              <Info aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
              {applicationsNote}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

export { ServiceDemoSelector };
