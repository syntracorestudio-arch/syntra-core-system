"use client";

import * as React from "react";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { motion, useReducedMotion, type Variants } from "framer-motion";

import { services } from "@/config/site";
import { EASE_PREMIUM, DURATION } from "@/lib/motion";
import { ROLE_COLOR, type RoleId } from "./roles";

/**
 * ServicesShowcase — Servicios v5 "Showcase imagery-led" (dirección final del owner,
 * a partir de sus referencias visuales de 2026-07-08). Grid 2×2 de paneles liderados
 * por un render 3D espectacular (vidrio/cromo electric+warm sobre navy), numeral GIGANTE
 * dorado, borde-glow del rol, y los 4 paneles conectados por un CIRCUITO hacia un núcleo
 * central (solo lg).
 *
 * Content-driven (services de site.ts; renders en /servicios/). Paleta SIN violeta/cyan.
 * Solo transform/opacity/filter → CLS 0 (min-h reservado; el hover no mueve layout).
 * reduced-motion safe (sin pulsos/breathe/reveal). next/image con sizes.
 */

/** Render 3D protagonista por módulo (832×640, fondo navy que funde con el panel). */
const MODULE_IMG: Record<string, string> = {
  web: "/servicios/modulo-web.jpg",
  ia: "/servicios/modulo-ia.jpg",
  automation: "/servicios/modulo-automatizacion.jpg",
  panel: "/servicios/modulo-panel.jpg",
};

/** Warm dorado del numeral y del núcleo del circuito. */
const WARM = "#e7c8a0";
/** Fondo navy del panel (funde con el fondo de los renders). */
const PANEL_BG = "#0a0e14";
/** Máscara: desvanece el borde IZQUIERDO de la imagen para fundirla al contenido. */
const IMG_MASK = "linear-gradient(to right, transparent 0%, #000 38%)";
/** Scrim de legibilidad izquierda→derecha (AA del texto sobre la imagen). */
const LEGIBILITY =
  "linear-gradient(to right, #0a0e14 0%, rgba(10,14,20,0.85) 40%, rgba(10,14,20,0.22) 70%, transparent 100%)";

function ServicesShowcase() {
  const reduce = useReducedMotion() ?? false;

  const grid: Variants = {
    hidden: {},
    show: {
      transition: { staggerChildren: reduce ? 0 : 0.12, delayChildren: reduce ? 0 : 0.05 },
    },
  };

  return (
    <div className="relative mx-auto mt-12 max-w-5xl lg:mt-16">
      <motion.div
        variants={grid}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.15 }}
        className="grid gap-5 sm:grid-cols-2 lg:gap-6"
      >
        {services.map((service, i) => (
          <ShowcasePanel key={service.id} service={service} index={i} reduce={reduce} />
        ))}
      </motion.div>
    </div>
  );
}

function ShowcasePanel({
  service,
  index,
  reduce,
}: {
  service: (typeof services)[number];
  index: number;
  reduce: boolean;
}) {
  const role = ROLE_COLOR[service.id as RoleId] ?? ROLE_COLOR.team;
  const img = MODULE_IMG[service.id] ?? MODULE_IMG.web;
  const numeral = String(index + 1).padStart(2, "0");

  const panel: Variants = {
    hidden: reduce ? { opacity: 1 } : { opacity: 0, y: 24, filter: "blur(6px)" },
    show: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: { duration: reduce ? 0 : DURATION.section, ease: EASE_PREMIUM },
    },
  };

  return (
    <motion.div
      variants={panel}
      whileHover={reduce ? undefined : { y: -6 }}
      transition={{ duration: 0.3, ease: EASE_PREMIUM }}
      className="group relative flex min-h-[22rem] rounded-2xl border lg:min-h-[26rem]"
      style={{ borderColor: `${role.hex}59`, backgroundColor: PANEL_BG, boxShadow: `0 0 34px -20px ${role.hex}` }}
    >
      {/* Glow del borde que intensifica en hover (opacity → no clipeado: el panel no
          lleva overflow-hidden; solo la imagen se recorta en su propio contenedor). */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -inset-px rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100 motion-reduce:transition-none"
        style={{ border: `1px solid ${role.hex}`, boxShadow: `0 0 55px -12px ${role.hex}` }}
      />

      {/* Render protagonista (mitad derecha) ENTERO: object-contain sobre el navy del
          asset (que funde con PANEL_BG → el letterbox es invisible). Base scale sutil
          anclado a la derecha para llenar sin recortar; en hover crece un poco más. */}
      <div className="pointer-events-none absolute inset-y-0 right-0 w-[62%] overflow-hidden rounded-r-2xl">
        <div className="relative h-full w-full origin-right scale-105 transition-transform duration-500 ease-out group-hover:scale-110 motion-reduce:transition-none">
          <Image
            src={img}
            alt=""
            fill
            sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 90vw"
            className="object-contain object-right"
            style={{ maskImage: IMG_MASK, WebkitMaskImage: IMG_MASK }}
          />
        </div>
      </div>

      {/* Scrim de legibilidad sobre la imagen (AA del texto) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-2xl"
        style={{ background: LEGIBILITY }}
      />

      {/* Contenido (mitad izquierda) */}
      <div className="relative z-10 flex w-full flex-col gap-3 p-6 sm:max-w-[64%] sm:p-8">
        <span
          className="font-heading text-5xl leading-none font-bold tracking-tight sm:text-6xl"
          style={{ color: WARM, opacity: 0.9 }}
        >
          {numeral}
        </span>
        <h3 className="mt-1 font-heading text-2xl leading-tight font-bold tracking-tight text-balance sm:text-3xl">
          {service.title}
        </h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {service.blurb}
        </p>
        <ul className="mt-1 space-y-1.5">
          {service.features.slice(0, 3).map((feature) => (
            <li key={feature} className="flex items-center gap-2 text-sm text-foreground/85">
              <span
                aria-hidden="true"
                className="size-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: role.hex }}
              />
              <span className="leading-snug">{feature}</span>
            </li>
          ))}
        </ul>
        <a
          href="#contacto"
          className="mt-auto inline-flex w-fit items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors hover:[background-color:var(--pill-tint)]"
          style={
            {
              borderColor: `${role.hex}80`,
              color: role.hex,
              "--pill-tint": `${role.hex}14`,
            } as React.CSSProperties
          }
        >
          Lo quiero para mi negocio
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </a>
      </div>
    </motion.div>
  );
}

export { ServicesShowcase };
