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
    <div className="flex h-full items-center justify-center gap-4">
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
          className="flex flex-col items-center gap-1.5"
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

/* ── CRITERIO · recomendación real: lo que sirve vs lo de más ──────────── */
function VisualCriterio({ active }: { active: boolean }) {
  const { rgb, hex } = PILLAR_THEME.criterio;
  const options = aboutPillarVisuals.criterio.options;
  return (
    <div className="flex h-full flex-col justify-center gap-2">
      {options.map((o, i) => (
        <motion.div
          key={o.label}
          initial={{ opacity: 0, x: -8 }}
          animate={active ? { opacity: 1, x: 0 } : {}}
          transition={{ delay: 0.2 + i * 0.12, duration: 0.45, ease: EASE_PREMIUM }}
          className="relative flex items-center gap-2.5 overflow-hidden rounded-lg border px-3 py-2"
          style={
            o.picked
              ? {
                  borderColor: `rgba(${rgb},0.55)`,
                  background: `linear-gradient(90deg, rgba(${rgb},0.20), rgba(${rgb},0.05))`,
                  boxShadow: `0 0 28px -6px rgba(${rgb},0.45)`,
                }
              : {
                  borderColor: "rgba(248,250,252,0.08)",
                  background: "rgba(248,250,252,0.03)",
                  opacity: 0.6,
                }
          }
        >
          {o.picked && (
            <motion.span
              aria-hidden="true"
              className="absolute inset-y-0 w-16"
              style={{
                background: `linear-gradient(100deg, transparent, rgba(${rgb},0.26), transparent)`,
              }}
              animate={active ? { left: ["-20%", "110%"] } : {}}
              transition={{ duration: 2.2, repeat: Infinity, repeatDelay: 1.6, ease: "easeInOut", delay: 1 }}
            />
          )}
          <span
            className="grid size-4 shrink-0 place-items-center rounded-full"
            style={
              o.picked
                ? { background: hex, boxShadow: `0 0 14px rgba(${rgb},0.8)` }
                : { border: "1px solid rgba(248,250,252,0.22)" }
            }
          >
            {o.picked && (
              <svg viewBox="0 0 10 10" className="size-2.5" fill="none">
                <motion.path
                  d="M1.5 5.2 4 7.5 8.5 2.5"
                  stroke="#0b1220"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  animate={active ? { pathLength: 1 } : {}}
                  transition={{ delay: 0.65, duration: 0.4, ease: EASE_PREMIUM }}
                />
              </svg>
            )}
          </span>
          <span
            className={`truncate text-xs font-medium ${o.picked ? "text-[#f3e3cc]" : "text-smoke-2/70"}`}
          >
            {o.label}
          </span>
          <span
            className="ml-auto shrink-0 font-accent text-[0.58rem] uppercase tracking-[0.14em]"
            style={{ color: o.picked ? hex : "rgba(148,163,184,0.55)" }}
          >
            {o.tag}
          </span>
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
          <span
            className="flex w-fit items-center gap-1.5 rounded-xl rounded-bl-sm border px-3.5 py-2.5"
            style={{
              borderColor: `rgba(${rgb},0.4)`,
              background: `linear-gradient(120deg, rgba(${rgb},0.22), rgba(${rgb},0.06))`,
              boxShadow: `0 0 28px -8px rgba(${rgb},0.5)`,
            }}
          >
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="size-1.5 rounded-full"
                style={{ background: `rgba(${rgb},0.95)` }}
                animate={active ? { opacity: [0.25, 1, 0.25], scale: [0.85, 1.15, 0.85] } : {}}
                transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.18, ease: "easeInOut" }}
              />
            ))}
          </span>
          <p className="mt-1 font-accent text-[0.58rem] uppercase tracking-[0.16em] text-smoke-2/50">
            {aboutPillarVisuals.cercania.typingLabel}
          </p>
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
        <motion.path
          d={ROUTE_PATH}
          stroke="url(#route-grad)"
          strokeWidth="2.5"
          strokeLinecap="round"
          filter="url(#route-glow)"
          initial={{ pathLength: 0 }}
          animate={active ? { pathLength: 1 } : {}}
          transition={{ delay: 0.25, duration: 1.1, ease: EASE_PREMIUM }}
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
          animate={active ? { scale: 1 } : {}}
          transition={{ delay: 0.9, duration: 0.35, ease: EASE_PREMIUM }}
        />
        {active && (
          <circle r="4" fill={hex} filter="url(#route-glow)">
            <animateMotion dur="3.2s" repeatCount="indefinite" path={ROUTE_PATH} />
          </circle>
        )}
      </svg>
      {/* Etiquetas reales de la ruta */}
      <span
        className="absolute bottom-1 left-[36%] -translate-x-1/2 font-accent text-[0.58rem] uppercase tracking-[0.16em]"
        style={{ color: `rgba(${rgb},0.75)` }}
      >
        {aboutPillarVisuals.compromiso.midLabel}
      </span>
      <motion.span
        initial={{ opacity: 0 }}
        animate={active ? { opacity: 1 } : {}}
        transition={{ delay: 1.4, duration: 0.5 }}
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

function PillarVisual({ id }: { id: string }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.4 });
  const Visual = VISUALS[id as PillarId];
  if (!Visual) return null;
  return (
    <div ref={ref} aria-hidden="true" className="mt-6 h-32 sm:h-36">
      <Visual active={inView} />
    </div>
  );
}

export { PillarVisual };
