"use client";

import * as React from "react";
import Image from "next/image";
import { useReducedMotion } from "framer-motion";

/**
 * ContactoCore — núcleo de marca SC del rail de Contacto (reference-lock contacto.md,
 * Ampliación v2). Pieza-firma SUTIL, CSS/SVG (sin WebGL): esfera con profundidad +
 * glow interno (núcleo "prendido") + borde de luz electric (fresnel-fake) + logo SC con
 * glow + halo detrás + un arco-cometa fino en rotación lentísima.
 *
 * Subordinado al form y al CTA (90/10): nunca más brillante que el botón "Enviar
 * consulta". Sin anillos orbitales, sin base/plataforma, sin cyan. Decorativo
 * (aria-hidden). CLS 0: alto/ancho reservados por el contenedor de tamaño fijo.
 * reduced-motion → el arco no rota (frame estático).
 */
function ContactoCore() {
  const reduceMotion = useReducedMotion();

  return (
    <div
      aria-hidden="true"
      className="relative grid size-44 shrink-0 place-items-center sm:size-52 lg:size-56"
    >
      {/* Halo de profundidad detrás: radial electric, difuminado */}
      <span
        className="pointer-events-none absolute -inset-10 rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgba(37,99,235,0.22), transparent 68%)",
        }}
      />

      {/* Esfera con volumen (clip a círculo) */}
      <span
        className="relative size-full overflow-hidden rounded-full ring-1 ring-accent-primary/35"
        style={{
          background:
            "radial-gradient(circle at 36% 28%, #24386040 0%, #122038 44%, #070c18 100%)",
          boxShadow:
            "inset 0 2px 26px rgba(0,0,0,0.55), inset 0 0 32px rgba(37,99,235,0.32), 0 0 52px -12px rgba(37,99,235,0.45)",
        }}
      >
        {/* Glow interno tenue: backlight sutil, sin lavar el logo (el SC manda) */}
        <span
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 50% 56%, rgba(45,110,235,0.13), transparent 44%)",
          }}
        />

        {/* Fresnel: realce de luz en el borde superior (cresta de vidrio) */}
        <span
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 65% at 50% -2%, rgba(150,190,255,0.28), transparent 48%)",
          }}
        />

        {/* Specular: highlight suave + un punto nítido (glassiness) */}
        <span
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 32% 24%, rgba(248,250,252,0.22), transparent 38%), radial-gradient(circle at 30% 22%, rgba(255,255,255,0.4), transparent 11%)",
          }}
        />

        {/* Arco-cometa: una traza larga tenue + un segmento corto brillante que orbita */}
        <svg
          viewBox="0 0 100 100"
          className={`absolute inset-0 size-full ${
            reduceMotion ? "" : "animate-[spin_22s_linear_infinite]"
          }`}
        >
          <circle
            cx="50"
            cy="50"
            r="46"
            fill="none"
            stroke="var(--brand-electric)"
            strokeOpacity="0.16"
            strokeWidth="0.6"
            strokeLinecap="round"
            strokeDasharray="58 250"
          />
          <circle
            cx="50"
            cy="50"
            r="46"
            fill="none"
            stroke="#8fb4ff"
            strokeOpacity="0.75"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeDasharray="13 276"
          />
        </svg>

        {/* Logo SC con glow electric (~42% del diámetro) */}
        <span className="absolute inset-0 grid place-items-center">
          <Image
            src="/logo.png"
            alt=""
            width={96}
            height={96}
            className="size-[42%] object-contain opacity-95 [filter:drop-shadow(0_0_10px_rgba(37,99,235,0.55))]"
          />
        </span>
      </span>
    </div>
  );
}

export { ContactoCore };
