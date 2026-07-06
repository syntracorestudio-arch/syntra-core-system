"use client";

import * as React from "react";
import { useReducedMotion } from "framer-motion";

/**
 * EmberParticles — polvo cálido en deriva lenta (Nosotros v4 · reutilizado en
 * FAQ "Puente térmico" vía props).
 * Canvas 2D liviano: brasas `accent-warm` que suben con vaivén y titilan.
 * DIFERENCIADO del campo de Contacto (azul, gravitacional, interactivo):
 * acá es ámbar, ascendente y NO reacciona al mouse (identidad, no invitación).
 * `thermal`: interpola el color por altura (warm arriba → electric abajo).
 * `densityDivisor`: mayor = menos partículas (default = Nosotros).
 * Pausa fuera de viewport (IntersectionObserver) · reduced-motion → nada
 * (el fondo estático ya da la atmósfera). Capa absoluta → CLS 0.
 */
function EmberParticles({
  className = "",
  thermal = false,
  densityDivisor = 26000,
}: {
  className?: string;
  thermal?: boolean;
  densityDivisor?: number;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const reduce = useReducedMotion() ?? false;

  React.useEffect(() => {
    if (reduce) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let running = false;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    type P = {
      x: number;
      y: number;
      r: number;
      vy: number;
      drift: number;
      phase: number;
      alpha: number;
      warm: boolean;
    };
    let parts: P[] = [];

    const spawn = (w: number, h: number): P => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: 0.6 + Math.random() * 1.6,
      vy: 0.08 + Math.random() * 0.22,
      drift: 0.15 + Math.random() * 0.35,
      phase: Math.random() * Math.PI * 2,
      alpha: 0.25 + Math.random() * 0.5,
      warm: Math.random() > 0.25,
    });

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = canvas;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const target = Math.round((w * h) / densityDivisor); // densidad baja
      parts = Array.from({ length: target }, () => spawn(w, h));
    };

    let t = 0;
    const tick = () => {
      if (!running) return;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);
      t += 0.016;
      for (const p of parts) {
        p.y -= p.vy;
        p.x += Math.sin(t * 0.6 + p.phase) * p.drift * 0.35;
        if (p.y < -4) {
          p.y = h + 4;
          p.x = Math.random() * w;
        }
        const twinkle = 0.7 + 0.3 * Math.sin(t * 1.4 + p.phase);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        if (thermal) {
          // Puente térmico (FAQ): warm arriba → electric abajo, por altura.
          const k = Math.min(Math.max(p.y / h, 0), 1);
          const cr = Math.round(231 + (37 - 231) * k);
          const cg = Math.round(200 + (99 - 200) * k);
          const cb = Math.round(160 + (235 - 160) * k);
          ctx.fillStyle = `rgba(${cr},${cg},${cb},${(p.alpha * twinkle * 0.9).toFixed(3)})`;
        } else {
          ctx.fillStyle = p.warm
            ? `rgba(231,200,160,${(p.alpha * twinkle).toFixed(3)})`
            : `rgba(148,163,184,${(p.alpha * twinkle * 0.5).toFixed(3)})`;
        }
        ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !running) {
          running = true;
          raf = requestAnimationFrame(tick);
        } else if (!entry.isIntersecting && running) {
          running = false;
          cancelAnimationFrame(raf);
        }
      },
      { rootMargin: "80px" },
    );

    resize();
    io.observe(canvas);
    window.addEventListener("resize", resize);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, [reduce, thermal, densityDivisor]);

  if (reduce) return null;
  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 size-full ${className}`}
    />
  );
}

export { EmberParticles };
