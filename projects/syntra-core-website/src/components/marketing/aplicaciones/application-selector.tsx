"use client";

import * as React from "react";
import { ArrowDown, ArrowRight, Check, Info } from "lucide-react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Variants,
} from "framer-motion";

import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";

export interface ApplicationItem {
  id: string;
  /** Nombre del rubro (label de la pill + encabezado del panel). */
  title: string;
  /** Ícono ya renderizado en el Server Component (evita pasar funciones). */
  icon: React.ReactNode;
  /** Situación típica del rubro. */
  situacion: string;
  /** Sistema que diseñaríamos (tono condicional). */
  sistema: string;
  /** Capacidades / qué incluiría. */
  capacidades: string[];
  /** Mini-flujo temporal: pasos en lenguaje de cliente; el último es el resultado. */
  flow: string[];
}

interface ApplicationSelectorProps {
  items: ApplicationItem[];
  note: string;
  className?: string;
}

/**
 * ApplicationSelector — segmented control de rubros + panel de escenario
 * (TASK-010C + presence pass 010D).
 *
 * Rail como control contenido (no tabs sueltas) + panel con hairline de acento,
 * header separado, cuerpo asimétrico (narrativa + sub-panel de capacidades
 * recesado) y nota de honestidad integrada como footer. Client island mínima:
 * solo el rubro activo. Sin loop/timers/listeners globales. Respeta
 * prefers-reduced-motion.
 */
function ApplicationSelector({ items, note, className }: ApplicationSelectorProps) {
  const reduce = useReducedMotion();
  const [activeId, setActiveId] = React.useState(items[0]?.id);
  const handleSelect = React.useCallback((id: string) => {
    track("application_tab_click", { industry: id });
    setActiveId(id);
  }, []);

  const active = items.find((it) => it.id === activeId) ?? items[0];

  // Stagger del mini-flujo: re-dispara al cambiar de rubro (el panel re-monta por key).
  const flowContainer: Variants = {
    hidden: {},
    visible: {
      transition: reduce ? {} : { staggerChildren: 0.08, delayChildren: 0.08 },
    },
  };
  const flowItem: Variants = {
    hidden: reduce ? { opacity: 1 } : { opacity: 0, y: 8 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: reduce ? 0 : 0.3, ease: [0.22, 1, 0.36, 1] },
    },
  };

  if (!active) return null;

  return (
    <div className={cn("flex flex-col", className)}>
      {/* === Rail: segmented control contenido === */}
      <div className="flex justify-center">
        <div
          role="tablist"
          aria-label="Rubros de aplicación"
          className="flex max-w-full gap-1 overflow-x-auto rounded-full border border-border bg-depth-sunken p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {items.map((item) => {
            const isActive = item.id === active.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => handleSelect(item.id)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-sm whitespace-nowrap transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/40",
                  isActive
                    ? "bg-surface-1 text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "shrink-0 transition-colors duration-200",
                    isActive ? "text-brand-cyan" : "text-muted-foreground",
                  )}
                >
                  {item.icon}
                </span>
                {item.title}
              </button>
            );
          })}
        </div>
      </div>

      {/* === Panel del escenario activo === */}
      <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-surface-1">
        {/* Hairline de acento superior */}
        <div
          aria-hidden="true"
          className="h-0.5 w-full bg-gradient-to-r from-transparent via-accent-primary/60 to-transparent"
        />

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={active.id}
            role="tabpanel"
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -8 }}
            transition={{ duration: reduce ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="p-6 sm:p-8"
          >
            {/* Header separado */}
            <div className="flex flex-wrap items-center gap-3 border-b border-border pb-5">
              <span className="text-brand-cyan">{active.icon}</span>
              <h3 className="font-heading text-xl font-semibold tracking-tight">
                {active.title}
              </h3>
              <span className="ml-auto rounded-full border border-border px-2.5 py-0.5 font-accent text-[10px] tracking-widest text-muted-foreground uppercase">
                Escenario de aplicación
              </span>
            </div>

            {/* Cuerpo: narrativa (1.1fr) · capacidades (0.9fr) con divisor */}
            <div className="grid gap-8 pt-6 lg:grid-cols-[1.1fr_0.9fr] lg:gap-10">
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-medium tracking-widest text-muted-foreground/70 uppercase">
                    Situación típica
                  </p>
                  <p className="leading-relaxed text-muted-foreground">
                    {active.situacion}
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-medium tracking-widest text-brand-cyan uppercase">
                    Lo que diseñaríamos
                  </p>
                  <p className="text-base leading-relaxed text-foreground">
                    {active.sistema}
                  </p>
                </div>
              </div>

              {/* Sub-panel recesado: capacidades del sistema */}
              <div className="rounded-xl border border-border bg-depth-sunken p-5 lg:p-6">
                <p className="text-xs font-medium tracking-widest text-muted-foreground/70 uppercase">
                  Qué incluiría
                </p>
                <ul className="mt-4 flex flex-col gap-3">
                  {active.capacidades.map((cap) => (
                    <li
                      key={cap}
                      className="flex items-start gap-3 text-sm text-foreground"
                    >
                      <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-md bg-accent-primary/10 text-brand-cyan">
                        <Check className="size-3.5" aria-hidden="true" />
                      </span>
                      {cap}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Mini-flujo temporal: el recorrido paso a paso */}
            <div className="mt-8 border-t border-border pt-6">
              <p className="text-xs font-medium tracking-widest text-muted-foreground/70 uppercase">
                El recorrido, paso a paso
              </p>
              <motion.div
                variants={flowContainer}
                initial="hidden"
                animate="visible"
                className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-2"
              >
                {active.flow.map((step, i) => {
                  const isLast = i === active.flow.length - 1;
                  return (
                    <React.Fragment key={step}>
                      <motion.div
                        variants={flowItem}
                        className="flex items-center gap-2.5 lg:flex-1 lg:flex-col lg:items-center lg:gap-2 lg:text-center"
                      >
                        <span
                          className={cn(
                            "size-1.5 shrink-0 rounded-full",
                            isLast ? "bg-brand-cyan" : "bg-muted-foreground/40",
                          )}
                        />
                        <span
                          className={cn(
                            "text-sm text-balance leading-snug lg:text-sm",
                            isLast ? "text-foreground" : "text-muted-foreground",
                          )}
                        >
                          {step}
                        </span>
                      </motion.div>
                      {!isLast && (
                        <div
                          aria-hidden="true"
                          className="flex shrink-0 items-center justify-center"
                        >
                          <div className="flex flex-col items-center lg:hidden">
                            <span className="h-5 w-px bg-gradient-to-b from-border to-brand-electric/40" />
                            <ArrowDown className="size-4 text-brand-electric/60" />
                          </div>
                          <div className="hidden items-center lg:flex">
                            <span className="h-px w-5 bg-gradient-to-r from-border to-brand-electric/40 lg:w-8" />
                            <ArrowRight className="size-4 text-brand-electric/60" />
                          </div>
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </motion.div>
            </div>

            {/* Footer de honestidad integrado */}
            <div className="mt-8 flex items-start gap-2 border-t border-border pt-4 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <span>{note}</span>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

export { ApplicationSelector };
