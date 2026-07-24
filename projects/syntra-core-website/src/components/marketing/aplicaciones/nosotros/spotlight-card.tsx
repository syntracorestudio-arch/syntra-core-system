"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * SpotlightCard — card premium con spotlight que sigue el mouse (Nosotros v4,
 * Variante A). Patrón de @magicui/magic-card adaptado a tokens SYNTRA sin sus
 * deps (next-themes / motion-react): CSS vars + transiciones GPU.
 *   · Spotlight interno warm que sigue el cursor.
 *   · Filo del borde se enciende alrededor del cursor (capa con máscara padding).
 *   · Lift sutil + sombra cálida en hover. Solo transform/opacity → CLS 0.
 */
function SpotlightCard({
  className,
  children,
  glowRgb = "231,200,160",
}: {
  className?: string;
  children: React.ReactNode;
  /** Color del spotlight/borde en hover y del campo inferior ("r,g,b"). */
  glowRgb?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - rect.left}px`);
    el.style.setProperty("--my", `${e.clientY - rect.top}px`);
  };

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      className={cn(
        // Chassis premium (ref Raycast/Resend): BORDE GRADIENTE (más claro
        // arriba — luz cenital) vía wrapper p-px, no border uniforme.
        "group relative rounded-2xl p-px",
        "bg-gradient-to-b from-slate-50/[0.14] via-border-strong/40 to-transparent",
        "transition-[transform,box-shadow] duration-300 ease-out hover:-translate-y-1",
        "hover:shadow-[0_18px_50px_-16px_rgba(var(--glow),0.3),0_8px_28px_-12px_rgba(0,0,0,0.6)]",
        className,
      )}
      style={
        {
          "--mx": "-200px",
          "--my": "-200px",
          "--glow": glowRgb,
        } as React.CSSProperties
      }
    >
      {/* Cuerpo: gradiente interno TRASLÚCIDO + blur — la atmósfera de la
          sección se filtra apenas por la card (no panel opaco). */}
      <div
        // max-lg:backdrop-blur-none — 4 cards con backdrop-filter sobre ~150 kpx c/u
        // eran ~600 kpx de backdrop en Nosotros; en GPU móvil es de lo más caro que hay.
        className="relative h-full overflow-hidden rounded-[calc(1rem-1px)] backdrop-blur-md max-lg:backdrop-blur-none"
        style={{
          background:
            "linear-gradient(180deg, rgba(14,20,36,0.88) 0%, rgba(10,15,28,0.84) 55%, rgba(7,11,20,0.80) 100%)",
        }}
      >
        {/* Campo de color propio de la card (ref Raycast: atmósfera por card) */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5"
          style={{
            background:
              "radial-gradient(75% 95% at 50% 105%, rgba(var(--glow),0.17), transparent 74%)",
          }}
        />
        {/* Luz cenital interna (asienta la card, evita el panel plano) */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-24"
          style={{
            background:
              "radial-gradient(60% 100% at 50% 0%, rgba(248,250,252,0.05), transparent 80%)",
          }}
        />
        {/* Spotlight interno (sigue el cursor, solo visible en hover) */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{
            background:
              "radial-gradient(300px circle at var(--mx) var(--my), rgba(var(--glow),0.12), transparent 65%)",
          }}
        />
        {/* Filo del borde encendido alrededor del cursor */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[calc(1rem-1px)] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{
            background:
              "radial-gradient(220px circle at var(--mx) var(--my), rgba(var(--glow),0.5), transparent 70%)",
            padding: 1,
            WebkitMask:
              "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
            WebkitMaskComposite: "xor",
            maskComposite: "exclude",
          }}
        />
        <div className="relative h-full">{children}</div>
      </div>
    </div>
  );
}

export { SpotlightCard };
