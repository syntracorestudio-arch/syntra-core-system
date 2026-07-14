"use client";

import * as React from "react";
import { motion, useInView } from "framer-motion";

import { aboutPillarVisuals } from "@/config/site";
import { getIcon } from "@/lib/icons";
import { EASE_PREMIUM } from "@/lib/motion";

/**
 * PillarVisual v3 — artefactos con CONTENIDO REAL (Nosotros v4).
 * Iteración tras feedback del owner: las cards de Raycast no llevan skeletons —
 * llevan texto real, íconos reales y mini-UI legible. Cada visual ahora dice
 * algo concreto:
 *   postura    → módulos con ícono + nombre (web · sistema · datos)
 *   criterio   → recomendación REAL: la opción que sirve vs las de más
 *   cercania   → conversación real (pregunta del cliente + SC escribiendo)
 *   compromiso → ruta neón: "lanzamiento" a mitad de camino → "seguimos con vos"
 * Microcopy content-driven: vive en site.ts (`aboutPillarVisuals`).
 * Colores = tokens con semántica. Loops gated por useInView.
 */

export const PILLAR_THEME = {
  postura: { hex: "#3b82f6", rgb: "59,130,246" }, // electric (construcción)
  criterio: { hex: "#e7c8a0", rgb: "231,200,160" }, // warm (criterio humano)
  cercania: { hex: "#60a5fa", rgb: "96,165,250" }, // electric claro (conversación viva) — sweep 2026-07-09
  compromiso: { hex: "#e7c8a0", rgb: "231,200,160" }, // warm = resultado que sigue (HECHO) — sweep 2026-07-09
} as const;
export type PillarId = keyof typeof PILLAR_THEME;

/* ── POSTURA · módulos reales del sistema (ícono + nombre) ─────────────── */
// Módulos resueltos a nivel módulo (getIcon en render viola static-components).
const POSTURA_MODULES = aboutPillarVisuals.postura.modules.map((m, i) => ({
  Icon: getIcon(m.icon),
  label: m.label,
  main: i === 1,
  size: i === 1 ? "size-[4.25rem]" : "size-14",
  delay: 0.2 + i * 0.16,
}));

function VisualPostura({ active }: { active: boolean }) {
  const { rgb } = PILLAR_THEME.postura;
  const modules = POSTURA_MODULES;
  return (
    <div className="relative flex h-full items-center justify-center gap-4">
      {/* Conector: los módulos se CONECTAN (t≈1.2s) y un dato viaja entre ellos.
          Línea detrás de los tiles (ellos la ocultan; vive en los gaps). */}
      <motion.span
        aria-hidden="true"
        className="absolute top-[50px] right-[16%] left-[16%] h-px origin-left"
        style={{
          background: `linear-gradient(90deg, rgba(${rgb},0.1), rgba(${rgb},0.55), rgba(${rgb},0.1))`,
          boxShadow: `0 0 8px rgba(${rgb},0.4)`,
        }}
        initial={{ scaleX: 0 }}
        animate={active ? { scaleX: 1 } : {}}
        transition={{ delay: 1.1, duration: 0.8, ease: EASE_PREMIUM }}
      />
      {active ? (
        <motion.span
          aria-hidden="true"
          className="absolute top-[47.5px] size-1.5 rounded-full"
          style={{
            background: `rgba(${rgb},0.95)`,
            boxShadow: `0 0 10px rgba(${rgb},0.9)`,
          }}
          initial={{ left: "16%", opacity: 0 }}
          animate={{ left: ["16%", "82%"], opacity: [0, 1, 1, 0] }}
          transition={{
            delay: 2.2,
            duration: 1.9,
            times: [0, 0.12, 0.88, 1],
            repeat: Infinity,
            repeatDelay: 1.6,
            ease: "easeInOut",
          }}
        />
      ) : null}
      {modules.map(({ Icon, label, size, delay, main }) => (
        <motion.div
          key={label}
          initial={{ opacity: 0, y: 14 }}
          animate={
            active
              ? main
                ? { opacity: 1, y: [0, -5, 0] }
                : { opacity: 1, y: 0 }
              : {}
          }
          transition={
            main
              ? {
                  opacity: { delay, duration: 0.5 },
                  y: { delay, duration: 3.2, repeat: Infinity, ease: "easeInOut" },
                }
              : { delay, duration: 0.5, ease: EASE_PREMIUM }
          }
          className="relative z-10 flex flex-col items-center gap-1.5"
        >
          <span
            className={`grid ${size} place-items-center rounded-xl border backdrop-blur-[1px]`}
            style={{
              borderColor: `rgba(${rgb},${main ? 0.7 : 0.4})`,
              background: `linear-gradient(160deg, rgba(${rgb},${main ? 0.4 : 0.22}), rgba(${rgb},0.07))`,
              boxShadow: main
                ? `0 0 34px -4px rgba(${rgb},0.65), inset 0 1px 0 rgba(191,219,254,0.4)`
                : `0 0 22px -8px rgba(${rgb},0.5), inset 0 1px 0 rgba(147,197,253,0.2)`,
            }}
          >
            <Icon
              strokeWidth={1.6}
              className={main ? "size-6 text-blue-100" : "size-5 text-blue-200/80"}
            />
          </span>
          <span className="font-accent text-[0.58rem] uppercase tracking-[0.18em] text-blue-200/60">
            {label}
          </span>
        </motion.div>
      ))}
    </div>
  );
}

/* ── CRITERIO · la recomendación se DECIDE en vivo (v2, formato carrusel) ──
 * Acto 1 (0-1s): las 3 opciones entran NEUTRAS e iguales (sin pick, sin tags).
 * Acto 2 (1.1-2.8s): un highlight de consideración las recorre de arriba a abajo.
 * Acto 3 (3.3s): SE ELIGE — check dorado se dibuja, la opción 1 florece warm,
 * las otras se apagan y sus tags se estampan. Idle: sheen sobre la elegida. */
/* Calibrado al ciclo de 6s del carrusel (ventana frontal ~4.7s): toda historia
 * termina a los ~4.2s — nada queda rozado por el pase. */
const PICK_T = 3.0;

function VisualCriterio({ active }: { active: boolean }) {
  const { rgb, hex } = PILLAR_THEME.criterio;
  const options = aboutPillarVisuals.criterio.options;
  return (
    <div className="flex h-full flex-col justify-center gap-2">
      {options.map((o, i) => (
        <motion.div
          key={o.label}
          initial={{ opacity: 0, x: -8 }}
          animate={
            active
              ? o.picked
                ? { opacity: 1, x: 0 }
                : // Atenuación LEVE (0.8): las no elegidas deben seguir legibles
                  { opacity: [0, 1, 1, 0.8], x: 0 }
              : {}
          }
          transition={
            o.picked
              ? { delay: 0.2 + i * 0.12, duration: 0.45, ease: EASE_PREMIUM }
              : {
                  opacity: {
                    delay: 0.2 + i * 0.12,
                    duration: PICK_T + 0.5 - (0.2 + i * 0.12),
                    times: [0, 0.12, 0.9, 1],
                  },
                  x: { delay: 0.2 + i * 0.12, duration: 0.45, ease: EASE_PREMIUM },
                }
          }
          className="relative flex items-center gap-2.5 overflow-hidden rounded-lg border px-3 py-2"
          style={{
            borderColor: "rgba(248,250,252,0.08)",
            background: "rgba(248,250,252,0.03)",
          }}
        >
          {/* Highlight de CONSIDERACIÓN: recorre las opciones antes de decidir */}
          <motion.span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-lg border"
            style={{ borderColor: `rgba(${rgb},0.6)` }}
            initial={{ opacity: 0 }}
            animate={active ? { opacity: [0, 1, 0] } : {}}
            transition={{ delay: 1.1 + i * 0.55, duration: 0.6, ease: "easeInOut" }}
          />

          {/* Florecimiento warm de la ELEGIDA (fondo + borde + glow, t=PICK_T) */}
          {o.picked ? (
            <motion.span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-lg border"
              style={{
                borderColor: `rgba(${rgb},0.55)`,
                background: `linear-gradient(90deg, rgba(${rgb},0.20), rgba(${rgb},0.05))`,
                boxShadow: `0 0 28px -6px rgba(${rgb},0.45)`,
              }}
              initial={{ opacity: 0 }}
              animate={active ? { opacity: 1 } : {}}
              transition={{ delay: PICK_T, duration: 0.5, ease: EASE_PREMIUM }}
            />
          ) : null}

          {/* Sheen idle sobre la elegida (post-decisión) */}
          {o.picked ? (
            <motion.span
              aria-hidden="true"
              className="absolute inset-y-0 w-16"
              style={{
                background: `linear-gradient(100deg, transparent, rgba(${rgb},0.26), transparent)`,
              }}
              animate={active ? { left: ["-20%", "110%"] } : {}}
              transition={{ duration: 2.2, repeat: Infinity, repeatDelay: 1.8, ease: "easeInOut", delay: PICK_T + 1.4 }}
            />
          ) : null}

          {/* Radio: neutro; la elegida se llena warm al decidir */}
          <span
            className="relative grid size-4 shrink-0 place-items-center rounded-full"
            style={{ border: "1px solid rgba(248,250,252,0.22)" }}
          >
            {o.picked ? (
              <>
                <motion.span
                  aria-hidden="true"
                  className="absolute inset-[-1px] rounded-full"
                  style={{ background: hex, boxShadow: `0 0 14px rgba(${rgb},0.8)` }}
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={active ? { opacity: 1, scale: 1 } : {}}
                  transition={{ delay: PICK_T, duration: 0.35, ease: EASE_PREMIUM }}
                />
                <svg viewBox="0 0 10 10" className="relative size-2.5" fill="none">
                  <motion.path
                    d="M1.5 5.2 4 7.5 8.5 2.5"
                    stroke="#0b1220"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: 0 }}
                    animate={active ? { pathLength: 1 } : {}}
                    transition={{ delay: PICK_T + 0.15, duration: 0.4, ease: EASE_PREMIUM }}
                  />
                </svg>
              </>
            ) : null}
          </span>

          <motion.span
            className="relative truncate text-xs font-medium"
            initial={{ color: "rgba(226,232,240,0.88)" }}
            animate={active && o.picked ? { color: "#f3e3cc" } : {}}
            transition={{ delay: PICK_T, duration: 0.4 }}
          >
            {o.label}
          </motion.span>

          {/* Tag: se ESTAMPA después de la decisión (antes no hay veredicto) */}
          <motion.span
            className="relative ml-auto shrink-0 font-accent text-[0.58rem] tracking-[0.14em] uppercase"
            style={{ color: o.picked ? hex : "rgba(203,213,225,0.8)" }}
            initial={{ opacity: 0, y: 3 }}
            animate={active ? { opacity: 1, y: 0 } : {}}
            transition={{
              delay: o.picked ? PICK_T + 0.2 : PICK_T + 0.4 + i * 0.12,
              duration: 0.35,
              ease: EASE_PREMIUM,
            }}
          >
            {o.tag}
          </motion.span>
        </motion.div>
      ))}
    </div>
  );
}

/* ── CERCANÍA · conversación real con quien construye ──────────────────── */
function VisualCercania({ active }: { active: boolean }) {
  const { rgb } = PILLAR_THEME.cercania;
  return (
    <div className="flex h-full flex-col justify-center gap-2.5">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={active ? { opacity: 1, y: 0 } : {}}
        transition={{ delay: 0.25, duration: 0.45, ease: EASE_PREMIUM }}
        className="ml-auto max-w-[80%] rounded-xl rounded-br-sm border border-slate-50/10 bg-slate-50/[0.06] px-3.5 py-2 backdrop-blur-[1px]"
      >
        <p className="text-xs leading-relaxed text-smoke-2">
          {aboutPillarVisuals.cercania.question}
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={active ? { opacity: 1, y: 0 } : {}}
        transition={{ delay: 0.55, duration: 0.45, ease: EASE_PREMIUM }}
        className="flex items-end gap-2.5"
      >
        <motion.span
          className="grid size-8 shrink-0 place-items-center rounded-full text-[0.6rem] font-bold text-white"
          style={{
            background: `linear-gradient(140deg, rgba(${rgb},0.95), rgba(${rgb},0.55))`,
          }}
          animate={
            active
              ? { boxShadow: [`0 0 16px rgba(${rgb},0.4)`, `0 0 26px rgba(${rgb},0.75)`, `0 0 16px rgba(${rgb},0.4)`] }
              : {}
          }
          transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
        >
          {aboutPillarVisuals.cercania.avatar}
        </motion.span>
        <div>
          {/* Burbuja de tamaño FIJO (la define la respuesta, siempre renderizada):
              typing dots encima → crossfade → la respuesta llega palabra por
              palabra (t≈2.8s). Antes el typing quedaba infinito = chat roto. */}
          <span
            className="relative flex w-fit items-center rounded-xl rounded-bl-sm border px-3.5 py-2.5"
            style={{
              borderColor: `rgba(${rgb},0.4)`,
              background: `linear-gradient(120deg, rgba(${rgb},0.22), rgba(${rgb},0.06))`,
              boxShadow: `0 0 28px -8px rgba(${rgb},0.5)`,
            }}
          >
            <p className="max-w-[15rem] text-xs leading-relaxed text-smoke-1">
              {aboutPillarVisuals.cercania.answer.split(" ").map((word, i) => (
                <motion.span
                  key={`${word}-${i}`}
                  initial={{ opacity: 0 }}
                  animate={active ? { opacity: 1 } : {}}
                  transition={{ delay: 2.7 + i * 0.08, duration: 0.25 }}
                >
                  {word}{" "}
                </motion.span>
              ))}
            </p>
            <motion.span
              aria-hidden="true"
              className="absolute inset-0 flex items-center justify-center gap-1.5"
              initial={{ opacity: 1 }}
              animate={active ? { opacity: 0 } : {}}
              transition={{ delay: 2.6, duration: 0.3 }}
            >
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="size-1.5 rounded-full"
                  style={{ background: `rgba(${rgb},0.95)` }}
                  animate={active ? { opacity: [0.25, 1, 0.25], scale: [0.85, 1.15, 0.85] } : {}}
                  transition={{ duration: 1.2, repeat: 2, delay: i * 0.18, ease: "easeInOut" }}
                />
              ))}
            </motion.span>
          </span>
          {/* Label: "escribiendo…" muta a "respondió" al llegar la respuesta */}
          <span className="relative mt-1 block h-4">
            <motion.span
              className="absolute left-0 font-accent text-[0.58rem] tracking-[0.16em] uppercase text-smoke-2/50"
              initial={{ opacity: 1 }}
              animate={active ? { opacity: 0 } : {}}
              transition={{ delay: 2.9, duration: 0.3 }}
            >
              {aboutPillarVisuals.cercania.typingLabel}
            </motion.span>
            <motion.span
              className="absolute left-0 font-accent text-[0.58rem] tracking-[0.16em] uppercase"
              style={{ color: `rgba(${rgb},0.75)` }}
              initial={{ opacity: 0 }}
              animate={active ? { opacity: 1 } : {}}
              transition={{ delay: 3.1, duration: 0.4 }}
            >
              {aboutPillarVisuals.cercania.answeredLabel}
            </motion.span>
          </span>
        </div>
      </motion.div>
    </div>
  );
}

/* ── COMPROMISO · la ruta sigue: lanzamiento → seguimos con vos ────────── */
const ROUTE_PATH = "M4 78 C 60 66, 96 30, 148 34 S 236 66, 268 38 S 316 10, 336 14";

function VisualCompromiso({ active }: { active: boolean }) {
  const { rgb, hex } = PILLAR_THEME.compromiso;
  return (
    <div className="relative flex h-full items-center">
      <svg viewBox="0 0 340 90" fill="none" className="h-full w-full" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="route-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor={hex} stopOpacity="0.05" />
            <stop offset="0.45" stopColor={hex} stopOpacity="0.55" />
            <stop offset="1" stopColor={hex} stopOpacity="1" />
          </linearGradient>
          <filter id="route-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="3.5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {/* Ruta en DOS ACTOS: se dibuja hasta "lanzamiento", FRENA (pausa
            deliberada — el momento donde otros se van) y SIGUE. El
            stop-and-continue ES el mensaje del pilar. */}
        <motion.path
          d={ROUTE_PATH}
          stroke="url(#route-grad)"
          strokeWidth="2.5"
          strokeLinecap="round"
          filter="url(#route-glow)"
          initial={{ pathLength: 0 }}
          animate={active ? { pathLength: [0, 0.44, 0.44, 1] } : {}}
          transition={{
            delay: 0.25,
            duration: 2.8,
            times: [0, 0.38, 0.58, 1],
            ease: "easeInOut",
          }}
        />
        <motion.circle
          cx="148"
          cy="34"
          r="5"
          fill="#0b1220"
          stroke={hex}
          strokeWidth="1.8"
          filter="url(#route-glow)"
          initial={{ scale: 0 }}
          animate={active ? { scale: [0, 1.35, 1] } : {}}
          transition={{ delay: 1.3, duration: 0.5, times: [0, 0.6, 1], ease: EASE_PREMIUM }}
        />
        {active && (
          <motion.g
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 3.4, duration: 0.5 }}
          >
            <circle r="4" fill={hex} filter="url(#route-glow)">
              <animateMotion dur="3.2s" repeatCount="indefinite" path={ROUTE_PATH} />
            </circle>
          </motion.g>
        )}
      </svg>
      {/* Etiquetas reales de la ruta: "lanzamiento" aparece cuando la ruta FRENA */}
      <motion.span
        className="absolute bottom-1 left-[36%] -translate-x-1/2 font-accent text-[0.58rem] tracking-[0.16em] uppercase"
        style={{ color: `rgba(${rgb},0.75)` }}
        initial={{ opacity: 0 }}
        animate={active ? { opacity: 1 } : {}}
        transition={{ delay: 1.45, duration: 0.45 }}
      >
        {aboutPillarVisuals.compromiso.midLabel}
      </motion.span>
      <motion.span
        initial={{ opacity: 0 }}
        animate={active ? { opacity: 1 } : {}}
        transition={{ delay: 3.0, duration: 0.5 }}
        className="absolute right-0 top-0 rounded-full border px-2.5 py-1 font-accent text-[0.58rem] uppercase tracking-[0.14em]"
        style={{
          color: hex,
          borderColor: `rgba(${rgb},0.45)`,
          background: `rgba(${rgb},0.10)`,
          boxShadow: `0 0 18px -4px rgba(${rgb},0.5)`,
        }}
      >
        {aboutPillarVisuals.compromiso.endLabel}
      </motion.span>
    </div>
  );
}

const VISUALS: Record<PillarId, React.ComponentType<{ active: boolean }>> = {
  postura: VisualPostura,
  criterio: VisualCriterio,
  cercania: VisualCercania,
  compromiso: VisualCompromiso,
};

/**
 * `isFront` (formato carrusel): cuando viene definido, el trigger es la LLEGADA
 * de la card al frente (useInView mediría geometría, no visibilidad — las cards
 * con visibility:hidden siguen "in view" y las 4 secuencias se dispararían
 * juntas). El grid mobile no lo pasa → conserva su useInView de siempre.
 */
function PillarVisual({ id, isFront }: { id: string; isFront?: boolean }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.4 });
  const Visual = VISUALS[id as PillarId];
  if (!Visual) return null;
  return (
    <div ref={ref} aria-hidden="true" className="mt-5 h-32 sm:h-36">
      <Visual active={isFront ?? inView} />
    </div>
  );
}

export { PillarVisual };
