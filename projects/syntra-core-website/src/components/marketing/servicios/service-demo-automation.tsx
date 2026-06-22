"use client";

import * as React from "react";
import { Bell, Check, ListChecks } from "lucide-react";
import {
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";

import { EASE_PREMIUM, DURATION } from "@/lib/motion";
import { SceneFrame, SceneAtmosphere } from "./scene-frame";

/**
 * ServiceDemoAutomation — escena premium (WEB-009F-B). Deja de ser diagrama de
 * nodos: muestra el RESULTADO real de automatizar — el trabajo repetitivo hecho
 * solo. Hermana de la escena Web (mismo `SceneFrame` + atmósfera + firma de
 * resultado cyan), pero diferenciada: Web = frame de navegador (lo público, de
 * cara al cliente); Automatización = panel interno de operación (lo que pasa
 * adentro del negocio). Paleta SYNTRA (slate / brand-electric / brand-cyan, 90/10).
 *
 * Tres planos Z:
 *  1. Fondo atmosférico compartido (`SceneAtmosphere`).
 *  2. Panel interno de operación: 3 tareas reales que se TILDAN SOLAS (sin botón
 *     que apretar = "se hace solo"), una ACTIVA por vez (electric por opacidad),
 *     cada una queda HECHA con check cyan persistente.
 *  3. Tarjeta-aviso flotante (Raycast, hermana de la de Web): "Aviso enviado · hace
 *     unos segundos", revela al final y PERSISTE (HECHO). z-20 para que no la tape
 *     el contenido del panel (z-10); banda inferior (pb) para no pisar la 3ª tarea.
 *
 * Motion (live-system-motion-spec): PENDIENTE → ACTIVO → HECHO, reveal por capas,
 * one-shot por viewport (useInView once + useReducedMotion). Solo opacity/transform
 * (translate/scale) — NUNCA box-shadow/filter/width/height/color/background. Sin
 * loops, sin parallax-scroll, sin partículas. Hover de profundidad sutil (desktop
 * fine-pointer) vía motion values; off en touch y reduced-motion. reduced-motion →
 * escena final completa directa (tareas tildadas + aviso), sin reveal ni hover.
 * CLS = 0: alto reservado; lo que aparece entra por opacity/transform. Copy en
 * lenguaje de cliente, sin jerga; sin logos de marca ni datos inventados.
 * Decorativo: aria-hidden.
 */

/* Timing de la secuencia por capas (s). Amplitudes/delays DISTINTOS por plano. */
const T_BG = 0; // fondo revela primero
const T_PANEL = 0.18; // el panel sube después
const T_TASKS_START = 0.6; // la primera tarea se tilda cuando el panel ya asentó
const T_STAGGER = 0.45; // recorrido deliberado entre tareas (una activa por vez)
const T_CARD = 1.9; // la tarjeta-aviso revela tras la última tarea y QUEDA

/* Tareas en lenguaje de cliente (beneficio, no mecanismo). Sin datos inventados.
   La primera lleva la consulta concreta (sub-cita) para dar contexto de qué entra,
   rimando con la "Nueva consulta" de la escena Web — sin sumar otro plano. */
const TASKS = [
  {
    label: "Entra una consulta",
    note: "“Quiero más información para mi negocio”",
  },
  { label: "Queda ordenada" },
  { label: "Tu equipo recibe el aviso" },
] as const;

function ServiceDemoAutomation() {
  const reduce = useReducedMotion();
  const ref = React.useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.25 });
  // La secuencia arranca al entrar en viewport (o directo si reduce).
  const run = reduce || inView;

  // ── Hover de profundidad (desktop fine-pointer). Mismos resortes que la escena
  // Web → la fila de Servicios se lee como un solo sistema. Off en touch/reduce.
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sx = useSpring(px, { stiffness: 120, damping: 18, mass: 0.4 });
  const sy = useSpring(py, { stiffness: 120, damping: 18, mass: 0.4 });
  const bgX = useTransform(sx, [-0.5, 0.5], [-3, 3]);
  const bgY = useTransform(sy, [-0.5, 0.5], [-3, 3]);
  const panelX = useTransform(sx, [-0.5, 0.5], [8, -8]);
  const panelY = useTransform(sy, [-0.5, 0.5], [8, -8]);
  const cardX = useTransform(sx, [-0.5, 0.5], [18, -18]);
  const cardY = useTransform(sy, [-0.5, 0.5], [16, -16]);

  const hoverEnabled = !reduce;

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!hoverEnabled || e.pointerType !== "mouse") return;
    const rect = e.currentTarget.getBoundingClientRect();
    px.set((e.clientX - rect.left) / rect.width - 0.5);
    py.set((e.clientY - rect.top) / rect.height - 0.5);
  }
  function handlePointerLeave() {
    px.set(0);
    py.set(0);
  }

  return (
    <div
      ref={ref}
      aria-hidden="true"
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className="relative"
    >
      {/* Wrapper relativo SIN overflow: deja flotar la tarjeta-aviso fuera del
          panel sin recortarse (el SceneFrame sí recorta su atmósfera). */}
      <div className="relative">
        <SceneFrame
          background={
            // ── Plano 1: fondo atmosférico compartido (detrás). Revela por opacity.
            <motion.div
              aria-hidden="true"
              className="absolute inset-0"
              style={hoverEnabled ? { x: bgX, y: bgY } : undefined}
              initial={reduce ? false : { opacity: 0 }}
              animate={run ? { opacity: 1 } : { opacity: 0 }}
              transition={{
                duration: reduce ? 0 : DURATION.hero,
                delay: reduce ? 0 : T_BG,
                ease: EASE_PREMIUM,
              }}
            >
              <SceneAtmosphere tone="ai" />
            </motion.div>
          }
        >
          {/* ── Plano 2: panel interno de operación (mid). Sube con opacity+y. */}
          <motion.div
            className="relative"
            style={hoverEnabled ? { x: panelX, y: panelY } : undefined}
            initial={reduce ? false : { opacity: 0, y: 22 }}
            animate={run ? { opacity: 1, y: 0 } : { opacity: 0, y: 22 }}
            transition={{
              duration: reduce ? 0 : DURATION.hero,
              delay: reduce ? 0 : T_PANEL,
              ease: EASE_PREMIUM,
            }}
          >
            <div className="overflow-hidden rounded-xl border border-border bg-surface-1 shadow-sm">
              {/* Cabecera del panel (sin chrome de navegador → es interno) */}
              <div className="flex items-center gap-2 border-b border-border bg-surface-2 px-4 py-2.5">
                <ListChecks
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                <span className="font-mono text-xs text-muted-foreground">
                  Tu operación · ejemplo
                </span>
              </div>

              {/* pb extra: banda inferior para que la tarjeta-aviso solape borde
                  vacío del panel, no la última tarea. */}
              <div className="flex flex-col gap-4 p-5 pb-12 sm:p-6 sm:pb-14">
                {/* Franja con el valor (mesh on-brand en CSS, igual rima que Web) */}
                <div className="relative overflow-hidden rounded-lg border border-border p-5">
                  <div
                    aria-hidden="true"
                    className="absolute inset-0"
                    style={{
                      background:
                        "radial-gradient(70% 80% at 18% 0%, rgba(37,99,235,0.28), transparent 70%), radial-gradient(60% 70% at 90% 100%, rgba(56,189,248,0.22), transparent 72%), linear-gradient(135deg, #111c33, #0b1120)",
                    }}
                  />
                  <div className="relative">
                    <h4 className="font-heading text-base font-semibold leading-snug tracking-tight text-foreground text-balance sm:text-lg">
                      Cada consulta se ordena sola
                    </h4>
                  </div>
                </div>

                {/* Lista de tareas que se tildan solas (PENDIENTE → ACTIVO → HECHO).
                    Altura estable (las filas siempre existen) → CLS = 0. */}
                <ul className="flex flex-col gap-2">
                  {TASKS.map((task, index) => {
                    const delay = reduce
                      ? 0
                      : T_TASKS_START + index * T_STAGGER;
                    return (
                      <li
                        key={task.label}
                        className="relative flex items-start gap-2.5 rounded-md border border-border bg-surface-2 px-3 py-2.5"
                      >
                        {/* ACTIVO: destello de acento electric one-shot (solo
                            opacity). Por el stagger, una tarea activa por vez. */}
                        {!reduce ? (
                          <motion.span
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-0 rounded-md border border-brand-electric/50 bg-brand-electric/10"
                            initial={{ opacity: 0 }}
                            animate={
                              run ? { opacity: [0, 0.7, 0.7, 0] } : { opacity: 0 }
                            }
                            transition={{
                              duration: DURATION.standard,
                              delay,
                              ease: EASE_PREMIUM,
                            }}
                          />
                        ) : null}

                        {/* Indicador de estado: PENDIENTE (dot neutro) → HECHO (check cyan) */}
                        <span className="relative inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-brand-cyan/40 bg-brand-cyan/15">
                          {/* PENDIENTE: dot neutro que se desvanece al completarse */}
                          <motion.span
                            className="absolute size-1.5 rounded-full bg-muted-foreground"
                            initial={reduce ? false : { opacity: 1 }}
                            animate={run ? { opacity: 0 } : { opacity: 1 }}
                            transition={{
                              duration: reduce ? 0 : DURATION.micro,
                              delay,
                              ease: EASE_PREMIUM,
                            }}
                          />
                          {/* HECHO: check cyan que revela (opacity + scale) y QUEDA */}
                          <motion.span
                            className="inline-flex text-brand-cyan"
                            initial={reduce ? false : { opacity: 0, scale: 0.6 }}
                            animate={
                              run
                                ? { opacity: 1, scale: 1 }
                                : { opacity: 0, scale: 0.6 }
                            }
                            transition={{
                              duration: reduce ? 0 : DURATION.standard,
                              delay,
                              ease: EASE_PREMIUM,
                            }}
                          >
                            <Check className="size-3" aria-hidden="true" />
                          </motion.span>
                        </span>

                        <div className="relative flex min-w-0 flex-col gap-0.5">
                          <span className="text-xs text-muted-foreground sm:text-sm">
                            {task.label}
                          </span>
                          {"note" in task ? (
                            <span className="text-pretty text-[0.7rem] italic leading-snug text-muted-foreground/70">
                              {task.note}
                            </span>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </motion.div>
        </SceneFrame>

        {/* ── Plano 3: tarjeta-aviso flotante (front, Raycast). Hermana de la de
            Web (misma firma cyan/glass) pero distinta por copy + ícono de aviso.
            Revela al final y QUEDA (HECHO persiste). Slot con alto reservado. */}
        <div className="pointer-events-none absolute right-3 -bottom-3 z-20 flex min-h-[4rem] w-[13.5rem] max-w-[72%] justify-end sm:right-5 sm:-bottom-4 sm:w-[15rem] sm:max-w-[80%] lg:w-[13rem] lg:max-w-[72%]">
          <motion.div
            style={hoverEnabled ? { x: cardX, y: cardY } : undefined}
            initial={reduce ? false : { opacity: 0, y: 20, scale: 0.94 }}
            animate={
              run
                ? { opacity: 1, y: 0, scale: 1 }
                : { opacity: 0, y: 20, scale: 0.94 }
            }
            transition={{
              duration: reduce ? 0 : DURATION.section,
              delay: reduce ? 0 : T_CARD,
              ease: EASE_PREMIUM,
            }}
            className="surface-glass w-full rounded-xl border border-brand-cyan/40 bg-surface-2/90 p-3.5"
          >
            <div className="flex items-center gap-2">
              <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-brand-cyan/40 bg-brand-cyan/15">
                <Bell className="size-3 text-brand-cyan" aria-hidden="true" />
              </span>
              <span className="font-accent text-[0.7rem] tracking-wide text-brand-cyan">
                Aviso enviado · hace unos segundos
              </span>
            </div>
            <p className="mt-2 text-xs leading-snug text-muted-foreground">
              Sin hacerlo a mano.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Badge de honestidad (lenguaje de cliente) */}
      <p className="mt-7 text-xs text-muted-foreground">
        Ejemplo · no es un cliente real
      </p>
    </div>
  );
}

export { ServiceDemoAutomation };
