"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Check, FileText, Table2 } from "lucide-react";

import { serviceDemos, serviceDemoScenes } from "@/config/site";
import { EASE_PREMIUM, DURATION } from "@/lib/motion";
import { useDemoLoop } from "./use-demo-loop";
import { DoneChip, DEMO_ACCENT } from "./demo-shared";

/**
 * DemoAutomation — FLUJO REAL, no genérico (pedido owner 2026-07-08): se ve
 * exactamente qué pasa con cada consulta usando los artefactos reales:
 *   1. El FORMULARIO de la web llega con sus campos (nombre/pedido/email).
 *   2. Aparece como FILA EN LA PLANILLA (mini-sheet con columnas, verde Sheets).
 *   3. El equipo recibe un MAIL con el pedido (decisión owner 2026-07-08:
 *      mail y no WhatsApp — mucho más simple de programar que la Business API,
 *      y la demo muestra solo lo que es realista implementar fácil).
 * Conectados por la línea de pipeline con pulso. Tema claro (herramienta real).
 * HECHO fuera del frame.
 *
 * Pasos: 0 idle · 1 llega el form · 2 pulso→planilla · 3 fila se escribe ·
 * 4 pulso→aviso · 5 notificación llega · 6 (final) HECHO.
 */

const AMBER = { hex: "#d97706", rgb: "217,119,6" };
const SHEETS = { hex: "#188038", rgb: "24,128,56" }; // verde Google Sheets real
const GMAIL = { hex: "#EA4335", rgb: "234,67,53" }; // rojo Gmail real
const HALO = DEMO_ACCENT.automatizacion;
const SCENE = serviceDemoScenes.automatizacion;
const DONE = serviceDemos[2].done;
const STEPS = 6;

function StageShell({
  visible,
  active,
  completed,
  rgb,
  reduce,
  children,
}: {
  visible: boolean;
  active: boolean;
  completed: boolean;
  rgb: string;
  reduce: boolean;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={false}
      animate={{ opacity: visible ? 1 : 0.22, x: visible ? 0 : -10 }}
      transition={{ duration: reduce ? 0 : DURATION.standard, ease: EASE_PREMIUM }}
      className="relative rounded-xl border bg-white px-3.5 py-3 shadow-sm transition-shadow duration-300"
      style={{
        borderColor: active || completed ? `rgba(${rgb},0.55)` : "rgb(226,232,240)",
        boxShadow: active
          ? `0 0 0 3px rgba(${rgb},0.12), 0 1px 2px rgba(0,0,0,0.05)`
          : "0 1px 2px rgba(0,0,0,0.05)",
      }}
    >
      {children}
      <motion.span
        initial={false}
        animate={{ scale: completed ? 1 : 0, opacity: completed ? 1 : 0 }}
        transition={{ duration: reduce ? 0 : DURATION.micro, ease: EASE_PREMIUM }}
        className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full border border-slate-200 bg-white shadow-sm"
        style={{ color: "#16a34a" }}
      >
        <Check className="size-3" aria-hidden="true" strokeWidth={2.6} />
      </motion.span>
    </motion.div>
  );
}

function DemoAutomation({ reduce }: { reduce: boolean }) {
  const { ref, step } = useDemoLoop({ steps: STEPS, stepMs: 1000, pauseMs: 3200, reduce });

  const lineProgress = step >= 4 ? 1 : step >= 2 ? 0.5 : 0;
  const doneShown = step >= STEPS;
  const rowWritten = step >= 3;

  return (
    <div ref={ref} aria-hidden="true" className="relative mx-auto w-full max-w-[27rem]">
      {/* Halo exterior (capa SYNTRA) */}
      <div
        className="pointer-events-none absolute -inset-6 -z-10 rounded-[2rem] blur-2xl"
        style={{ background: `linear-gradient(165deg, rgba(${HALO.rgb},0.22), rgba(37,99,235,0.16))` }}
      />

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white px-5 py-5 shadow-[0_44px_100px_-32px_rgba(0,0,0,0.85)] ring-1 ring-black/20">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-800">
            Qué pasa cuando entra una consulta
          </span>
          <motion.span
            animate={reduce ? undefined : { opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
            className="flex items-center gap-1.5 text-[9px] font-semibold tracking-wide text-emerald-600 uppercase"
          >
            <span className="size-1.5 rounded-full bg-emerald-500" />
            En vivo
          </motion.span>
        </div>

        <div className="relative flex flex-col gap-3.5 pl-4">
          {/* Línea del pipeline + pulso viajero */}
          <div className="absolute bottom-8 left-0 top-6 w-px bg-slate-200">
            <motion.span
              initial={false}
              animate={{ scaleY: lineProgress }}
              transition={{ duration: reduce ? 0 : 0.7, ease: EASE_PREMIUM }}
              className="absolute inset-0 origin-top"
              style={{ background: `linear-gradient(180deg, rgb(${AMBER.rgb}), rgb(${SHEETS.rgb}))` }}
            />
            {!reduce && (step === 2 || step === 4) ? (
              <motion.span
                key={step}
                initial={{ top: step === 2 ? "0%" : "50%", opacity: 0 }}
                animate={{ top: step === 2 ? "50%" : "96%", opacity: [0, 1, 1, 0] }}
                transition={{ duration: 0.8, ease: "easeInOut" }}
                className="absolute -left-[3px] size-[7px] rounded-full"
                style={{ background: "#2563eb", boxShadow: "0 0 12px 2px rgba(37,99,235,0.7)" }}
              />
            ) : null}
          </div>

          {/* 1 · FORMULARIO WEB (campos reales) */}
          <StageShell visible={step >= 1} active={step >= 1 && step < 3} completed={step >= 3} rgb={AMBER.rgb} reduce={reduce}>
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-[11px] font-semibold text-slate-800">
                <span className="grid size-6 place-items-center rounded-md" style={{ background: `rgba(${AMBER.rgb},0.12)`, color: AMBER.hex }}>
                  <FileText className="size-3.5" aria-hidden="true" />
                </span>
                {SCENE.entrada.title}
              </span>
              <span className="shrink-0 text-[9px] text-slate-400">{SCENE.entrada.meta}</span>
            </div>
            {/* minmax(0,1fr): una pista `1fr` arranca con min-width:auto, y como
                el valor lleva `truncate` (white-space:nowrap) su tamaño mínimo es
                el texto ENTERO. La pista no podía achicarse y empujaba la grilla
                más allá del ancho del teléfono. */}
            <div className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 rounded-lg bg-slate-50 px-3 py-2">
              {SCENE.entrada.fields.map(([k, v]) => (
                <React.Fragment key={k}>
                  <span className="text-[9px] font-medium tracking-wide text-slate-400 uppercase">{k}</span>
                  <span className="truncate text-[10.5px] font-medium text-slate-700">{v}</span>
                </React.Fragment>
              ))}
            </div>
          </StageShell>

          {/* 2 · PLANILLA (mini-sheet real, verde Sheets) */}
          <StageShell visible={step >= 2} active={step === 3} completed={step >= 4} rgb={SHEETS.rgb} reduce={reduce}>
            <span className="flex items-center gap-2 text-[11px] font-semibold text-slate-800">
              <span className="grid size-6 place-items-center rounded-md" style={{ background: `rgba(${SHEETS.rgb},0.12)`, color: SHEETS.hex }}>
                <Table2 className="size-3.5" aria-hidden="true" />
              </span>
              {SCENE.registro.title}
            </span>
            <div className="mt-2 overflow-hidden rounded-lg border border-slate-200">
              <div className="grid grid-cols-[2.6rem_minmax(0,1fr)_minmax(0,1.4fr)_2.9rem] border-b border-slate-200 bg-slate-50">
                {SCENE.registro.headers.map((h) => (
                  <span key={h} className="border-r border-slate-200 px-1.5 py-1 text-[8px] font-semibold text-slate-500 uppercase last:border-r-0">
                    {h}
                  </span>
                ))}
              </div>
              <motion.div
                initial={false}
                animate={{ background: rowWritten ? `rgba(${SHEETS.rgb},0.08)` : "rgba(255,255,255,1)" }}
                transition={{ duration: reduce ? 0 : 0.4 }}
                className="grid grid-cols-[2.6rem_minmax(0,1fr)_minmax(0,1.4fr)_2.9rem]"
              >
                {SCENE.registro.row.map((cell, i) => (
                  <motion.span
                    key={i}
                    initial={false}
                    animate={{ opacity: rowWritten ? 1 : 0 }}
                    transition={{ duration: reduce ? 0 : 0.25, delay: reduce ? 0 : i * 0.12 }}
                    className="truncate border-r border-slate-100 px-1.5 py-1.5 text-[9.5px] font-medium text-slate-700 last:border-r-0"
                  >
                    {i === 3 ? (
                      <span className="rounded-full px-1.5 py-0.5 text-[8px] font-bold" style={{ background: `rgba(${AMBER.rgb},0.12)`, color: "#b45309" }}>
                        {cell}
                      </span>
                    ) : (
                      cell
                    )}
                  </motion.span>
                ))}
              </motion.div>
            </div>
          </StageShell>

          {/* 3 · MAIL AL EQUIPO (fila de inbox estilo Gmail) */}
          <StageShell visible={step >= 5} active={step === 5} completed={step >= STEPS} rgb={GMAIL.rgb} reduce={reduce}>
            <span className="text-[11px] font-semibold text-slate-800">{SCENE.aviso.title}</span>
            <motion.div
              initial={false}
              animate={step >= 5 ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: -10, scale: 0.97 }}
              transition={{ duration: reduce ? 0 : DURATION.standard, ease: EASE_PREMIUM }}
              className="mt-2 flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 shadow-sm"
            >
              {/* Ícono Gmail real (glifo simple-icons, sobre por colores) */}
              <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-slate-200 bg-white">
                <svg viewBox="0 0 24 24" className="size-4.5" aria-hidden="true" fill={GMAIL.hex}>
                  <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457Z" />
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[10px] font-bold text-slate-800">{SCENE.aviso.sender}</span>
                  <span className="shrink-0 text-[8.5px] text-slate-400">{SCENE.aviso.time}</span>
                </div>
                <p className="mt-0.5 truncate text-[10px] font-semibold text-slate-700">{SCENE.aviso.subject}</p>
                <p className="truncate text-[9.5px] leading-snug text-slate-500">{SCENE.aviso.body}</p>
              </div>
            </motion.div>
          </StageShell>
        </div>
      </div>

      {/* HECHO — fuera del frame (capa SYNTRA) */}
      <div className="mt-4 flex justify-center">
        <DoneChip label={DONE} shown={doneShown} reduce={reduce} />
      </div>
    </div>
  );
}

export { DemoAutomation };
