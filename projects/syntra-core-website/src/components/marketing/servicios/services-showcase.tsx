"use client";

import * as React from "react";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import useEmblaCarousel from "embla-carousel-react";
import AutoScroll from "embla-carousel-auto-scroll";
import type { EmblaOptionsType } from "embla-carousel";

import { services } from "@/config/site";
import { EASE_PREMIUM, DURATION } from "@/lib/motion";
import { ROLE_COLOR, type RoleId } from "./roles";

/**
 * ServicesShowcase — Servicios v5 "Showcase imagery-led" (dirección final del owner,
 * a partir de sus referencias visuales de 2026-07-08). Paneles liderados por un render 3D
 * espectacular (vidrio/cromo electric+warm sobre navy), numeral GIGANTE dorado, borde-glow
 * del rol. En lg+ los paneles corren en un CARRUSEL Embla infinito (deriva lenta con
 * AutoScroll; frena al hover/focus y se puede ARRASTRAR con inercia); en mobile/tablet
 * quedan en stack; reduced-motion → grid estático.
 *
 * Content-driven (services de site.ts; renders en /servicios/). Paleta SIN violeta/cyan.
 * Solo transform/opacity/filter → CLS 0 (altura de panel reservada; el hover no mueve
 * layout). reduced-motion safe. next/image con sizes.
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
/** Fundido de los bordes del carrusel (las cards entran/salen con elegancia). */
const EDGE_FADE = "linear-gradient(to right, transparent, #000 6%, #000 94%, transparent)";

/** Opciones de Embla: loop + arrastre libre con inercia; align al inicio, sin snaps. */
const EMBLA_OPTIONS: EmblaOptionsType = {
  loop: true,
  dragFree: true,
  align: "start",
  skipSnaps: true,
};

/**
 * ServicesShowcase — grid en mobile/tablet (stack, layout previo) y CARRUSEL EMBLA en lg+
 * (deriva lenta continua vía AutoScroll; se FRENA al hover/focus y se puede ARRASTRAR con
 * inercia física — dragFree). Reduced-motion → grid 2×2 estático (sin carrusel).
 *
 * Loop: Embla en loop mueve slides por transform (no clona DOM), y necesita contenido
 * ≥ ~2× el viewport. Con 4 slides de 30rem no alcanza, así que duplicamos a 8 (2 tandas);
 * la 2ª va aria-hidden + su CTA tabIndex -1 → sin doblar tab-stops ni árbol a11y.
 *
 * Tilt premium: al arrastrar rápido las cards se inclinan (rotateZ ≤ ±1.5°) proporcional a
 * la velocidad del scrollBody de Embla, con spring de vuelta a 0. Solo transform → CLS 0.
 */
function ServicesShowcase() {
  const reduce = useReducedMotion() ?? false;

  // AutoScroll: deriva lenta (~la del marquee 70s). Frena al hover/focus; NO frena tras
  // arrastrar (retoma solo). Se omite el plugin bajo reduced-motion.
  const autoScroll = React.useMemo(
    () =>
      AutoScroll({
        speed: 0.7,
        startDelay: 0,
        stopOnInteraction: false,
        stopOnMouseEnter: true,
        stopOnFocusIn: true,
      }),
    [],
  );
  const plugins = React.useMemo(() => (reduce ? [] : [autoScroll]), [reduce, autoScroll]);
  const [emblaRef, emblaApi] = useEmblaCarousel(EMBLA_OPTIONS, plugins);

  // Tilt por velocidad de arrastre (motion value → sin re-render de React).
  const tilt = useMotionValue(0);
  const tiltSpring = useSpring(tilt, { stiffness: 140, damping: 18, mass: 0.4 });
  React.useEffect(() => {
    if (!emblaApi) return;
    const clamp = (n: number) => Math.max(-1.5, Math.min(1.5, n));
    const onScroll = () => {
      // velocity() ≈ px/frame; ×0.15 mapea un fling a ±1.5° (la deriva lenta ≈ 0°).
      tilt.set(clamp(emblaApi.internalEngine().scrollBody.velocity() * 0.15));
    };
    emblaApi.on("scroll", onScroll);
    return () => {
      emblaApi.off("scroll", onScroll);
    };
  }, [emblaApi, tilt]);

  // Grid responsive: mobile SIEMPRE; y en lg cuando hay reduced-motion (sin carrusel).
  // Dos columnas SOLO desde lg. Con sm:grid-cols-2 la card medía 278px a 640 y
  // 342px a 768, y su columna de texto (64% del panel, el resto es el render)
  // caía a 177-218px — MÁS ANGOSTA que en un teléfono de 390px (348px), con un
  // numeral de 60px y un h3 de 30px adentro. Encogía para entrar en vez de
  // reorganizarse (auditoría responsive 2026-07-22).
  const grid = (
    <motion.div
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: reduce ? 0 : DURATION.section, ease: EASE_PREMIUM }}
      className="grid gap-5 lg:grid-cols-2 lg:gap-6"
    >
      {services.map((service, i) => (
        <ShowcasePanel key={service.id} service={service} index={i} reduce={reduce} />
      ))}
    </motion.div>
  );

  if (reduce) {
    return <div className="mx-auto mt-12 max-w-5xl lg:mt-16">{grid}</div>;
  }

  return (
    <div className="mx-auto mt-12 max-w-5xl lg:mt-16">
      {/* Mobile / tablet: stack (layout previo — mejor lectura que un carrusel touch de
          cards altas). */}
      <div className="lg:hidden">{grid}</div>

      {/* Desktop lg+: carrusel Embla. El fundido de bordes va en el wrapper EXTERNO (no
          interfiere con el drag del viewport). */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: DURATION.section, ease: EASE_PREMIUM }}
        className="hidden lg:block"
        style={{ maskImage: EDGE_FADE, WebkitMaskImage: EDGE_FADE }}
      >
        {/* Viewport de Embla: overflow-hidden + cursor de agarre. `py-10` da aire vertical
            al glow/lift del hover (el overflow recorta también en vertical). */}
        <div
          ref={emblaRef}
          className="cursor-grab overflow-hidden py-10 active:cursor-grabbing"
        >
          {/* Container de Embla (Embla le aplica el translate del scroll) */}
          <div className="flex">
            {[...services, ...services].map((service, i) => {
              const duplicate = i >= services.length;
              return (
                <div
                  key={i}
                  aria-hidden={duplicate || undefined}
                  className="mr-6 w-[30rem] flex-none"
                >
                  {/* Wrapper del tilt: rota ±1.5° con la velocidad de arrastre (elemento
                      aparte del slide, que Embla puede transformar en el loop). */}
                  <motion.div className="h-full will-change-transform" style={{ rotate: tiltSpring }}>
                    <ShowcasePanel
                      service={service}
                      index={i % services.length}
                      reduce={reduce}
                      duplicate={duplicate}
                    />
                  </motion.div>
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function ShowcasePanel({
  service,
  index,
  reduce,
  duplicate = false,
}: {
  service: (typeof services)[number];
  index: number;
  reduce: boolean;
  /** Card de la 2ª tanda del marquee: su CTA sale del tab-order (no dobla foco). */
  duplicate?: boolean;
}) {
  const role = ROLE_COLOR[service.id as RoleId] ?? ROLE_COLOR.team;
  const img = MODULE_IMG[service.id] ?? MODULE_IMG.web;
  const numeral = String(index + 1).padStart(2, "0");

  return (
    <motion.div
      whileHover={reduce ? undefined : { y: -6 }}
      transition={{ duration: 0.3, ease: EASE_PREMIUM }}
      className="group relative flex h-full min-h-[22rem] rounded-2xl border lg:min-h-[26rem]"
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

      {/* Refuerzo SOLO en mobile. El scrim de arriba está calibrado para el
          layout de escritorio, donde el texto vive en el 64% izquierdo: al 70%
          del ancho ya es casi transparente. En un teléfono la card mide 342px y
          no hay lugar para un lado a lado, así que el texto ocupa el ANCHO
          COMPLETO y los bullets caen sobre la parte brillante del render.
          Con esto el render se vuelve textura y el texto se lee limpio.
          (Lo encontró la revisión con visión a 390px, no la medición: una
          superposición no desborda, no recorta y no cambia ningún número.) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-2xl sm:hidden"
        style={{
          background:
            "linear-gradient(to right, #0a0e14 0%, rgba(10,14,20,0.90) 42%, rgba(10,14,20,0.66) 100%)",
        }}
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
          tabIndex={duplicate ? -1 : undefined}
          // max-lg:py-2.5 → 40px de alto en táctil (medía 30px) sin mover el
          // pill en desktop, que es donde se calibró.
          className="mt-auto inline-flex w-fit items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors max-lg:py-2.5 hover:[background-color:var(--pill-tint)]"
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
