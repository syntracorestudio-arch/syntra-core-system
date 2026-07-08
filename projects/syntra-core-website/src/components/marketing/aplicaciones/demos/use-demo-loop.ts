"use client";

import * as React from "react";
import { useReducedMotion } from "framer-motion";

/**
 * useDemoLoop — motor de loop compartido de las demos vivas de Casos v2.
 *
 * Reutiliza el patrón probado de `use-case-chat-scene`: timers encadenados +
 * IntersectionObserver (pausa fuera de viewport) + soporte reduced-motion. El
 * loop avanza `step` de 0 → `steps` (el estado FINAL siempre es `steps`), hace
 * una pausa larga y reinicia, incrementando `cycle` en cada vuelta (para
 * re-disparar animaciones one-shot como los counters).
 *
 * reduced-motion → `step` fijo en `steps` (estado final completo) y `cycle` 0,
 * sin timers. El selector monta SOLO la demo activa (AnimatePresence): al
 * desmontar, el cleanup del effect limpia los timers y el observer.
 */
export interface DemoLoopOptions {
  /** Número total de pasos; el estado final visible es `steps`. */
  steps: number;
  /** ms entre pasos de avance. */
  stepMs?: number;
  /** ms de pausa en el estado final antes de reiniciar. */
  pauseMs?: number;
  /** ms de retardo antes del primer paso. */
  startMs?: number;
  /** Override de reduced-motion (el selector ya lo calcula una vez). */
  reduce?: boolean;
}

export function useDemoLoop({
  steps,
  stepMs = 900,
  pauseMs = 2600,
  startMs = 320,
  reduce: reduceProp,
}: DemoLoopOptions) {
  const reducedHook = useReducedMotion();
  const reduce = reduceProp ?? reducedHook ?? false;

  const ref = React.useRef<HTMLDivElement>(null);
  const [inView, setInView] = React.useState(false);
  const [step, setStep] = React.useState(0);
  const [cycle, setCycle] = React.useState(0);

  // Pausa el loop fuera del viewport (performance + no distraer).
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Loop encadenado. Los setState viven dentro del timer (nunca síncronos en el
  // effect). Cleanup en unmount o cuando cae fuera de viewport.
  React.useEffect(() => {
    if (reduce || !inView) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let i = 0;
    let first = true;
    const tick = () => {
      if (cancelled) return;
      setStep(i);
      if (i === 0 && !first) setCycle((c) => c + 1);
      first = false;
      i = i < steps ? i + 1 : 0;
      timer = setTimeout(tick, i === 0 ? pauseMs : stepMs);
    };
    timer = setTimeout(tick, startMs);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [reduce, inView, steps, stepMs, pauseMs, startMs]);

  return {
    ref,
    step: reduce ? steps : step,
    cycle: reduce ? 0 : cycle,
    reduce,
    inView,
  } as const;
}
