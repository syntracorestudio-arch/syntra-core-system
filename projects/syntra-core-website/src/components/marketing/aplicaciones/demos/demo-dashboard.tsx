"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { BarChart3, Inbox, Search, Settings, Users } from "lucide-react";

import { serviceDemos, serviceDemoScenes } from "@/config/site";
import { EASE_PREMIUM, DURATION } from "@/lib/motion";
import { useDemoLoop } from "./use-demo-loop";
import { DoneChip, TrafficDots, DEMO_ACCENT } from "./demo-shared";

/**
 * DemoDashboard — PANEL SAAS REAL en tema claro (pedido owner 2026-07-08:
 * nada de cards azules SYNTRA — que parezca un producto de verdad). Interior
 * blanco con la gramática de un admin real: sidebar gris, KPIs, sparkline
 * verde (crecimiento), tabla con estados en los colores universales de SaaS
 * (ámbar/azul/verde). El chrome oscuro y el halo son la capa SYNTRA; HECHO
 * fuera del frame.
 *
 * Pasos: 0 idle · 1 KPIs cuentan · 2 sparkline se dibuja · 3 filas entran ·
 * 4 (final) HECHO.
 */

const ACCENT = DEMO_ACCENT.panel; // halo exterior (SYNTRA)
const SCENE = serviceDemoScenes.panel;
const DONE = serviceDemos[3].done;
const STEPS = 4;
const GREEN = "22,163,74"; // #16a34a — crecimiento/éxito (SaaS real)

const STATUS_STYLE: Record<string, { fg: string; bg: string; border: string }> = {
  Nueva: { fg: "#b45309", bg: "rgba(217,119,6,0.10)", border: "rgba(217,119,6,0.35)" },
  "En curso": { fg: "#1d4ed8", bg: "rgba(59,130,246,0.10)", border: "rgba(59,130,246,0.35)" },
  Respondida: { fg: "#15803d", bg: "rgba(22,163,74,0.10)", border: "rgba(22,163,74,0.35)" },
};

/** Counter que cuenta 0→value cuando `run`; re-corre en cada ciclo del loop. */
function CountUp({ value, run, cycle, reduce }: { value: number; run: boolean; cycle: number; reduce: boolean }) {
  const [n, setN] = React.useState(reduce ? value : 0);
  React.useEffect(() => {
    if (reduce || !run) {
      const target = reduce ? value : 0;
      const id = setTimeout(() => setN(target), 0);
      return () => clearTimeout(id);
    }
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setN(Math.min(i, value));
      if (i >= value) clearInterval(id);
    }, Math.max(500 / Math.max(value, 1), 40));
    return () => clearInterval(id);
  }, [run, value, cycle, reduce]);
  return <>{n}</>;
}

const SPARK_PATH = "M2 26 C 10 24, 16 18, 24 19 S 40 12, 48 14 S 62 6, 70 8 S 84 4, 92 3";

function DemoDashboard({ reduce }: { reduce: boolean }) {
  const { ref, step, cycle } = useDemoLoop({ steps: STEPS, stepMs: 1050, pauseMs: 3000, reduce });
  const doneShown = step >= STEPS;

  return (
    <div ref={ref} aria-hidden="true" className="relative mx-auto w-full max-w-[30rem]">
      {/* Halo exterior (capa SYNTRA) */}
      <div
        className="pointer-events-none absolute -inset-6 -z-10 rounded-[2rem] blur-2xl"
        style={{ background: `radial-gradient(60% 55% at 50% 40%, rgba(${ACCENT.rgb},0.2), transparent 70%)` }}
      />

      <div className="overflow-hidden rounded-2xl border border-white/10 shadow-[0_44px_100px_-32px_rgba(0,0,0,0.85)] ring-1 ring-black/20">
        {/* Topbar de la app (clara) */}
        <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50 px-3.5 py-2.5">
          <TrafficDots />
          <span className="text-[10.5px] font-semibold text-slate-700">{SCENE.header}</span>
          <span className="ml-auto flex items-center gap-1.5 rounded-md bg-white px-2 py-1 text-[9px] text-slate-400 ring-1 ring-slate-200">
            <Search className="size-2.5" aria-hidden="true" />
            Buscar
          </span>
        </div>

        <div className="flex bg-white">
          {/* Sidebar clara */}
          <div className="flex flex-col items-center gap-3 border-r border-slate-200 bg-slate-50 px-2.5 py-3.5">
            {[Inbox, Users, BarChart3, Settings].map((Icon, i) => (
              <span
                key={i}
                className="grid size-6 place-items-center rounded-md"
                style={
                  i === 0
                    ? { background: "rgba(59,130,246,0.12)", color: "#1d4ed8" }
                    : { color: "#94a3b8" }
                }
              >
                <Icon className="size-3.5" aria-hidden="true" />
              </span>
            ))}
          </div>

          {/* Contenido claro */}
          <div className="flex-1 space-y-3 px-3.5 py-3.5">
            {/* KPIs */}
            <div className="grid grid-cols-3 gap-2">
              {SCENE.counters.map((c) => (
                <div
                  key={c.label}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 shadow-sm"
                >
                  <p className="text-[8.5px] tracking-wide text-slate-400 uppercase">{c.label}</p>
                  <p className="mt-0.5 text-[17px] font-bold text-slate-900 tabular-nums">
                    <CountUp value={c.value} run={step >= 1} cycle={cycle} reduce={reduce} />
                  </p>
                </div>
              ))}
            </div>

            {/* Sparkline verde (crecimiento real) */}
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[9px] tracking-wide text-slate-400 uppercase">
                  Consultas por día
                </span>
                <span className="text-[9px] font-semibold" style={{ color: "#16a34a" }}>
                  +12 esta semana
                </span>
              </div>
              <svg viewBox="0 0 94 30" fill="none" className="mt-1.5 h-9 w-full" preserveAspectRatio="none">
                <motion.path
                  key={cycle}
                  d={SPARK_PATH}
                  stroke="#16a34a"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  initial={{ pathLength: reduce ? 1 : 0, opacity: reduce ? 1 : 0.4 }}
                  animate={step >= 2 ? { pathLength: 1, opacity: 1 } : {}}
                  transition={{ duration: reduce ? 0 : 0.9, ease: EASE_PREMIUM }}
                  style={{ filter: `drop-shadow(0 1px 3px rgba(${GREEN},0.35))` }}
                />
              </svg>
            </div>

            {/* Tabla de consultas */}
            <div className="overflow-hidden rounded-lg border border-slate-200">
              {SCENE.rows.map((row, i) => {
                const st = STATUS_STYLE[row.status] ?? STATUS_STYLE.Nueva;
                return (
                  <motion.div
                    key={row.name}
                    initial={false}
                    animate={{ opacity: step >= 3 ? 1 : 0, x: step >= 3 ? 0 : -12 }}
                    transition={{
                      duration: reduce ? 0 : DURATION.standard,
                      ease: EASE_PREMIUM,
                      delay: reduce ? 0 : i * 0.12,
                    }}
                    className={`flex items-center gap-2.5 bg-white px-3 py-2 ${i > 0 ? "border-t border-slate-100" : ""} ${i === 0 ? "bg-slate-50" : ""}`}
                  >
                    <span className="grid size-5 shrink-0 place-items-center rounded-full bg-blue-600 text-[8px] font-bold text-white">
                      {row.name.charAt(0)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[10.5px] font-semibold text-slate-800">{row.name}</p>
                      <p className="truncate text-[9px] text-slate-400">{row.detail}</p>
                    </div>
                    <span
                      className="shrink-0 rounded-full border px-2 py-0.5 text-[8.5px] font-semibold"
                      style={{ borderColor: st.border, background: st.bg, color: st.fg }}
                    >
                      {row.status}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* HECHO — fuera del frame (capa SYNTRA) */}
      <div className="mt-4 flex justify-center">
        <DoneChip label={DONE} shown={doneShown} reduce={reduce} />
      </div>
    </div>
  );
}

export { DemoDashboard };
