"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Anima un número de 0 → value al montar (easeOutCubic, ~450ms). Portado de
 * StudioFlow (patrón aprobado). reduced-motion → el valor aparece directo.
 * SSR/no-JS arranca en el valor final: nunca se ve un 0 mentiroso.
 */
export function CountUp({
  value,
  prefix = "",
  className,
}: {
  value: number;
  prefix?: string;
  className?: string;
}) {
  const [n, setN] = useState(value);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || value === 0) return;
    const dur = 450;
    const t0 = performance.now();
    let raf = requestAnimationFrame(function tick(t: number) {
      const p = Math.min((t - t0) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(p < 1 ? value * eased : value);
      if (p < 1) raf = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return (
    <span className={className}>
      {prefix}
      {Math.round(n).toLocaleString("es-AR")}
    </span>
  );
}
