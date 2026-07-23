"use client";

import * as React from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowRight, Check, Lock, Shirt } from "lucide-react";

import { serviceDemos, serviceDemoScenes } from "@/config/site";
import { EASE_PREMIUM, DURATION } from "@/lib/motion";
import { useDemoLoop } from "./use-demo-loop";
import { DoneChip, TrafficDots, DEMO_ACCENT } from "./demo-shared";

/**
 * DemoLanding — SITIO REAL DE CLIENTE (pedido owner 2026-07-08: nada de cards
 * azules SYNTRA — que parezca la web de verdad de "Talleres del Sur"). Interior
 * en TEMA CLARO con marca propia del cliente (ámbar taller #d97706), foto real
 * generada en el hero, nav mini, cards de servicios y formulario claro que se
 * auto-completa. El chrome del navegador y el halo exterior son la única capa
 * SYNTRA. HECHO fuera del frame.
 *
 * Pasos: 0 hero · 1 cards · 2 tipea nombre · 3 tipea email · 4 tipea mensaje ·
 * 5 submit · 6 (final) HECHO.
 */

const ACCENT = DEMO_ACCENT.landing; // halo exterior (SYNTRA)
const BRAND = { hex: "#d97706", rgb: "217,119,6" }; // marca del cliente (ámbar retail)
const SCENE = serviceDemoScenes.landing;
const DONE = serviceDemos[0].done;
const STEPS = 6;

type FieldState = "idle" | "typing" | "done";

function fieldState(step: number, typingStep: number): FieldState {
  if (step < typingStep) return "idle";
  if (step === typingStep) return "typing";
  return "done";
}

/** Campo claro que se "tipea" carácter a carácter cuando está activo. */
function TypedField({
  label,
  value,
  state,
  reduce,
}: {
  label: string;
  value: string;
  state: FieldState;
  reduce: boolean;
}) {
  const [shown, setShown] = React.useState(reduce ? value : "");

  React.useEffect(() => {
    if (reduce || state !== "typing") {
      const target = reduce || state === "done" ? value : "";
      const id = setTimeout(() => setShown(target), 0);
      return () => clearTimeout(id);
    }
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setShown(value.slice(0, i));
      if (i >= value.length) clearInterval(id);
    }, 42);
    return () => clearInterval(id);
  }, [state, value, reduce]);

  const filled = shown.length > 0;
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[9px] font-medium tracking-wide text-slate-500 uppercase">{label}</span>
      <div
        className="flex min-h-[1.9rem] items-center rounded-md border bg-white px-2.5 py-1 text-[11px] transition-colors"
        style={{
          borderColor: state !== "idle" ? `rgba(${BRAND.rgb},0.55)` : "rgb(226,232,240)",
          boxShadow: state === "typing" ? `0 0 0 2px rgba(${BRAND.rgb},0.15)` : "none",
        }}
      >
        <span className={filled ? "text-slate-800" : "text-slate-400"}>
          {filled ? shown : label}
        </span>
        {state === "typing" && !reduce ? (
          <motion.span
            aria-hidden="true"
            className="ml-0.5 inline-block h-3 w-px bg-slate-700"
            animate={{ opacity: [1, 0, 1] }}
            transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
          />
        ) : null}
      </div>
    </div>
  );
}

function DemoLanding({ reduce }: { reduce: boolean }) {
  const { ref, step } = useDemoLoop({ steps: STEPS, stepMs: 950, pauseMs: 2800, reduce });

  const scrolled = step >= 2;
  const submitted = step >= 5;
  const doneShown = step >= STEPS;

  return (
    <div ref={ref} aria-hidden="true" className="relative mx-auto w-full max-w-[30rem]">
      {/* Halo exterior (capa de presentación SYNTRA) */}
      <div
        className="pointer-events-none absolute -inset-6 -z-10 rounded-[2rem] blur-2xl"
        style={{ background: `radial-gradient(60% 55% at 50% 40%, rgba(${ACCENT.rgb},0.26), transparent 70%)` }}
      />

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0d1426] shadow-[0_44px_100px_-32px_rgba(0,0,0,0.85)] ring-1 ring-black/20">
        {/* Chrome del navegador */}
        <div className="flex items-center gap-3 border-b border-white/10 bg-[#0d1426] px-3.5 py-2.5">
          <TrafficDots />
          <div className="flex flex-1 items-center gap-1.5 rounded-md bg-white/5 px-2.5 py-1 text-[10px] text-slate-400">
            <Lock className="size-2.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{SCENE.url}</span>
          </div>
        </div>

        {/* SITIO DEL CLIENTE — tema claro, marca propia.
            Alto de la ventana RESPONSIVE (2026-07-23): <640px las 3 cards y los
            campos envuelven y el contenido llega a ~547px (medido a 320) — con
            21rem el botón del form quedaba cortado tras el scroll de -10rem.
            24.5rem muestra hasta 552px de contenido; sm+ conserva 21rem. */}
        <div className="relative h-[24.5rem] overflow-hidden bg-[#f8fafc] sm:h-[21rem]">
          <motion.div
            initial={false}
            // -10rem = nav (2.5) + hero (7.5): el scroll final arranca limpio en las
            // cards y el formulario queda completo (nada semi-cortado en el borde).
            animate={{ y: scrolled ? "-10rem" : "0rem" }}
            transition={{ duration: reduce ? 0 : DURATION.section, ease: EASE_PREMIUM }}
            className="absolute inset-x-0 top-0 flex flex-col"
          >
            {/* Nav mini del sitio (alto fijo: el corte del scroll depende de él) */}
            <div className="flex h-10 items-center justify-between bg-white px-4 shadow-sm">
              <span className="flex items-center gap-1.5 text-[10px] font-bold tracking-tight text-slate-800">
                <span
                  className="grid size-4 place-items-center rounded"
                  style={{ background: BRAND.hex }}
                >
                  <Shirt className="size-2.5 text-white" aria-hidden="true" />
                </span>
                {SCENE.brand}
              </span>
              <span className="flex items-center gap-3 text-[8.5px] text-slate-500">
                <span>Servicios</span>
                <span>Nosotros</span>
                <span
                  className="rounded-md px-2 py-1 font-semibold text-white"
                  style={{ background: BRAND.hex }}
                >
                  {SCENE.cta}
                </span>
              </span>
            </div>

            {/* Hero con la FOTO REAL */}
            <div className="relative flex h-[7.5rem] flex-col justify-center gap-1 overflow-hidden px-4">
              <Image
                src="/demo-assets/tienda-hero.jpg"
                alt=""
                fill
                sizes="480px"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/45 to-black/15" />
              <p className="relative max-w-[70%] text-[15px] leading-tight font-bold text-white text-balance">
                {SCENE.headline}
              </p>
              <p className="relative max-w-[62%] text-[9.5px] leading-snug text-white/80">
                {SCENE.sub}
              </p>
              <span
                className="relative mt-1 inline-flex w-fit items-center gap-1 rounded-md px-2.5 py-1.5 text-[10px] font-semibold text-white shadow-lg"
                style={{ background: BRAND.hex }}
              >
                {SCENE.cta}
                <ArrowRight className="size-3" aria-hidden="true" />
              </span>
            </div>

            {/* Cards de servicios (claras) */}
            <div className="grid grid-cols-3 gap-2 px-4 py-3">
              {SCENE.cards.map((card, i) => (
                <motion.div
                  key={card}
                  initial={false}
                  animate={{ opacity: step >= 1 ? 1 : 0.4, y: step >= 1 ? 0 : 6 }}
                  transition={{ duration: reduce ? 0 : DURATION.micro, ease: EASE_PREMIUM, delay: reduce ? 0 : i * 0.08 }}
                  className="flex flex-col gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-2.5 shadow-sm"
                >
                  <span
                    className="grid size-5 place-items-center rounded-md"
                    style={{ background: `rgba(${BRAND.rgb},0.12)` }}
                  >
                    <Check className="size-3" style={{ color: BRAND.hex }} aria-hidden="true" />
                  </span>
                  <span className="text-[9px] leading-tight font-medium text-slate-600">{card}</span>
                </motion.div>
              ))}
            </div>

            {/* Formulario claro que se auto-completa */}
            <div className="mx-4 mb-4 flex flex-col gap-2.5 rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm">
              <span className="text-[11px] font-bold text-slate-800">Consultanos</span>
              <TypedField label="Nombre" value={SCENE.form.nombre} state={fieldState(step, 2)} reduce={reduce} />
              <TypedField label="Email" value={SCENE.form.email} state={fieldState(step, 3)} reduce={reduce} />
              <TypedField label="Mensaje" value={SCENE.form.mensaje} state={fieldState(step, 4)} reduce={reduce} />
              <motion.span
                initial={false}
                animate={{
                  opacity: submitted ? 1 : 0.85,
                  background: submitted ? "#16a34a" : BRAND.hex,
                }}
                transition={{ duration: reduce ? 0 : DURATION.micro }}
                className="mt-0.5 inline-flex items-center justify-center gap-1 rounded-md px-3 py-2 text-[10.5px] font-semibold text-white"
              >
                {submitted ? (
                  <>
                    <Check className="size-3" aria-hidden="true" /> ¡Consulta enviada!
                  </>
                ) : (
                  "Enviar consulta"
                )}
              </motion.span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* HECHO — fuera del frame (capa SYNTRA) */}
      <div className="mt-4 flex justify-center">
        <DoneChip label={DONE} shown={doneShown} reduce={reduce} />
      </div>
    </div>
  );
}

export { DemoLanding };
