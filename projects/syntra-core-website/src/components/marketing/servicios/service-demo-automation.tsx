"use client";

import { ArrowDown, ArrowRight, Check, Inbox, ListChecks } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

import { EASE_PREMIUM } from "@/lib/motion";

/**
 * ServiceDemoAutomation — blueprint de 3 nodos conectados.
 * WEB-009B: ÚNICO loop continuo del set de demos. Un acento recorre los 3
 * nodos en secuencia (solo un nodo activo por momento) y el nodo "resultado"
 * se realza al cerrar el ciclo. Implementado con un overlay de acento por nodo
 * (animate opacity) + scale sutil del dot del resultado en su fase.
 * Solo se anima opacity/transform (scale) — NUNCA box-shadow/filter.
 * useReducedMotion → render estático (el resultado ya muestra su acento).
 * Lenguaje del conector reusado del repo (gradiente from-border to-brand-electric/40).
 * Labels en lenguaje de cliente, sin jerga técnica. Decorativo: aria-hidden.
 */
const nodes = [
  { icon: Inbox, label: "Entra", result: false },
  { icon: ListChecks, label: "Se ordena", result: false },
  { icon: Check, label: "Avisa", result: true },
] as const;

/** Duración del ciclo completo (s) — lento y premium. */
const CYCLE = 6.3;
/** Fracción del ciclo asignada a cada nodo (3 nodos → ~1/3 cada uno). */
const PHASE = 1 / nodes.length;

function ServiceDemoAutomation() {
  const reduce = useReducedMotion();

  return (
    <div
      aria-hidden="true"
      className="rounded-xl border border-border bg-depth-sunken p-5 sm:p-6"
    >
      <div className="flex flex-col items-stretch gap-3 lg:flex-row lg:items-center lg:justify-between">
        {nodes.map((node, index) => {
          const Icon = node.icon;
          const isLast = index === nodes.length - 1;
          // Ventana de actividad del nodo dentro del ciclo [0..1].
          const start = index * PHASE;
          const peak = start + PHASE * 0.45;
          const end = start + PHASE * 0.9;
          return (
            <div
              key={node.label}
              className="flex flex-col items-center gap-3 lg:flex-1 lg:flex-row lg:gap-0"
            >
              {/* Nodo */}
              <div className="flex flex-1 flex-col items-center gap-2 lg:flex-none">
                <span
                  className={
                    node.result
                      ? "relative flex size-12 items-center justify-center rounded-xl border border-brand-electric/30 bg-surface-2 text-accent-secondary"
                      : "flex size-12 items-center justify-center rounded-xl border border-border-strong bg-surface-2 text-muted-foreground"
                  }
                >
                  {/* Overlay de acento que recorre los nodos (solo opacity) */}
                  {!reduce ? (
                    <motion.span
                      className="pointer-events-none absolute inset-0 rounded-xl border border-brand-electric/50 bg-brand-electric/10"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: [0, 0, 1, 0, 0] }}
                      transition={{
                        repeat: Infinity,
                        duration: CYCLE,
                        ease: EASE_PREMIUM,
                        times: [0, start, peak, end, 1],
                      }}
                    />
                  ) : null}
                  <Icon className="size-5" />
                  {node.result ? (
                    reduce ? (
                      <span className="absolute -right-1 -top-1 size-2.5 rounded-full bg-brand-cyan" />
                    ) : (
                      // El dot del resultado late (scale) en su fase del ciclo.
                      <motion.span
                        className="absolute -right-1 -top-1 size-2.5 rounded-full bg-brand-cyan"
                        animate={{ scale: [1, 1, 1.45, 1, 1] }}
                        transition={{
                          repeat: Infinity,
                          duration: CYCLE,
                          ease: EASE_PREMIUM,
                          times: [0, start, peak, end, 1],
                        }}
                      />
                    )
                  ) : null}
                </span>
                <span className="text-xs text-muted-foreground">{node.label}</span>
              </div>

              {/* Conector (no después del último nodo) */}
              {!isLast ? (
                <>
                  {/* Mobile: vertical */}
                  <div className="flex flex-col items-center lg:hidden">
                    <span className="h-5 w-px bg-gradient-to-b from-border to-brand-electric/40" />
                    <ArrowDown className="size-4 text-brand-electric/60" />
                  </div>
                  {/* Desktop: horizontal */}
                  <div className="hidden items-center lg:flex">
                    <span className="h-px w-6 bg-gradient-to-r from-border to-brand-electric/40 xl:w-10" />
                    <ArrowRight className="size-4 text-brand-electric/60" />
                  </div>
                </>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { ServiceDemoAutomation };
