"use client";

import * as React from "react";
import { ArrowRight } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";
import { getIcon } from "@/lib/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/layout/section";
import { SHELL_ESCENARIO } from "@/components/layout/container";
import { TrackedLink } from "@/components/shared/tracked-link";
import { HeroAnillos } from "@/components/marketing/hero/hero-anillos";
import { HeroCamara, GRAIN } from "@/components/marketing/hero/hero-camara";
import Image from "next/image";

/**
 * HeroSection — primera impresión y <h1> único (WEB-HERO-RED, ref owner 2026-07-16).
 * Protagonista = "LA RED": esfera-red 3D real-time (nodos + líneas plexus con núcleo
 * dorado y Bloom) que vive en la zona derecha; el fondo nunca es un navy plano. Texto a
 * la izquierda sobre scrim; H1 con entrada palabra-por-palabra SOLO desktop (en
 * mobile/SSR queda estático → LCP intacto). Reemplaza el VIDEO placeholder.
 *
 * La red: lazy (decider desktop+motion, ssr:false), frameloop pausado fuera de viewport,
 * fade-in que nunca bloquea el paint del H1. Mobile/reduced → radial navy limpio.
 */

/** Easing de la referencia (fade-up editorial). */
const EASE_WORDS = [0.22, 1, 0.36, 1] as const;

/** Palabras del H1 con stagger (solo cuando `animate`; si no, estático = SSR/LCP). */
function TitleWords({
  text,
  animate,
  startIndex,
  gradient = false,
}: {
  text: string;
  animate: boolean;
  startIndex: number;
  gradient?: boolean;
}) {
  const words = text.split(" ");
  return (
    <>
      {words.map((w, i) => (
        <motion.span
          key={`${w}-${i}`}
          className={`inline-block ${gradient ? "text-gradient-brand" : ""}`}
          initial={animate ? { opacity: 0, y: 32 } : false}
          animate={animate ? { opacity: 1, y: 0 } : undefined}
          transition={{
            duration: 0.7,
            delay: 0.15 + (startIndex + i) * 0.08,
            ease: EASE_WORDS,
          }}
        >
          {w}
          {i < words.length - 1 ? " " : ""}
        </motion.span>
      ))}
    </>
  );
}

/** Media query reactiva (useSyncExternalStore — SSR false → H1 estático en server). */
function useDesktop() {
  const subscribe = React.useCallback((cb: () => void) => {
    const mql = window.matchMedia("(min-width: 1024px)");
    mql.addEventListener("change", cb);
    return () => mql.removeEventListener("change", cb);
  }, []);
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia("(min-width: 1024px)").matches,
    () => false,
  );
}

function HeroSection() {
  const { hero, cta } = siteConfig;
  const reduce = useReducedMotion() ?? false;
  const desktop = useDesktop();
  // Stagger de palabras SOLO desktop sin reduce: en mobile el H1 es el LCP y debe
  // pintar estático desde el SSR (lección WEB-PERF-A).
  const animateTitle = desktop && !reduce;
  const leadWords = hero.titleLead.split(" ").length;
  const highlightWords = hero.titleHighlight.split(" ").length;

  /**
   * Entrada escalonada del bloque above-the-fold. Es CSS (clase `hero-rise` en
   * globals.css), no framer: la media query decide sin JS y la animación corre
   * en el primer pintado.
   *
   * El subtítulo es MÁS GRANDE que el H1 en un teléfono (29988 vs 20832 px² a
   * 390px) ⇒ era él quien se quedaba con el LCP, y viajaba en el HTML servido
   * con opacity:0 esperando a que hidratara framer-motion. Build de producción,
   * 4G lento, CPU 4x: 4068ms → 1480ms. Desktop conserva su entrada intacta.
   */
  const rise = (i: number, className?: string) => ({
    className: cn("hero-rise", className),
    style: { "--hero-rise-delay": `${(0.08 + i * 0.09).toFixed(2)}s` } as React.CSSProperties,
  });

  return (
    <Section
      id="inicio"
      contained={false}
      className="relative flex items-center overflow-hidden md:min-h-[88svh] lg:min-h-[100svh]"
    >
      {/* === Base del fondo: aire oscuro + grano + costura con Servicios. El hero
          NO repite la película de la Home; es el acto de apertura. Todo CSS (0KB,
          nítido, sin banding) y es el fondo COMPLETO en mobile/reduced-motion. === */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-20">
        <HeroCamara />
      </div>

      {/* === "LAS PLACAS" + "EL VÓRTICE": UN canvas full-bleed (comparten
          z-buffer ⇒ las placas se ocluyen contra la silueta del nudo). Capa PROPIA
          fuera del fondo -z-20 porque el drag necesita hit-testing real; las
          placas tienen densidad 0 sobre la columna del texto. === */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0">
        <HeroAnillos />
      </div>

      {/* === Capas que van ENCIMA del canvas (solo desktop, que es donde monta).
          "LA TINTA" es un quad OPACO full-bleed: ocluye todo lo que esté debajo,
          así que el grano, el scrim de legibilidad y la costura con Servicios
          tienen que vivir acá arriba. El grano encima del gradiente es requisito
          de la dirección: es lo que lo vuelve atmósfera fotografiada y no un
          render limpio de Spline. === */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[1] hidden lg:block"
      >
        <div
          className="absolute inset-0 opacity-[0.16] mix-blend-overlay"
          style={{ backgroundImage: GRAIN, backgroundRepeat: "repeat" }}
        />
        {/* Calma para el texto: elipse suave sobre la columna izquierda — NO un
            lavado lineal (ese mataba la escena; lección de la dirección). */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(46% 78% at 22% 50%, rgba(5,7,12,0.82) 0%, rgba(5,7,12,0.55) 45%, transparent 78%)",
          }}
        />
        {/* Costura con Servicios (el canvas llega hasta el borde inferior). */}
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#04070e] to-transparent" />
      </div>

      {/* === Contenido === */}
      {/* z-10: el canvas es un elemento POSICIONADO (z-0) y un quad opaco — sin
          contexto propio, el contenido estático se pintaría DEBAJO y el H1
          desaparecería. */}
      <div
        className={cn(
          SHELL_ESCENARIO,
          "pointer-events-none relative z-10 grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12",
        )}
      >
        {/* Columna izquierda: copy / acción / prueba */}
        <div className="pointer-events-auto flex flex-col items-center gap-7 text-center lg:items-start lg:text-left">
          <div className="flex flex-col items-center gap-5 lg:items-start">
            <div {...rise(0)}>
              <Badge
                variant="neutral"
                className="max-w-full text-balance text-center leading-snug whitespace-normal"
              >
                {hero.badge}
              </Badge>
            </div>

            {/* H1: en mobile/SSR pinta ESTÁTICO (es el LCP); en desktop las
                palabras entran escalonadas (patrón referencia, fade-up 0.08s). */}
            <h1 className="font-heading text-4xl leading-[1.08] font-bold tracking-tight text-balance sm:text-5xl xl:text-6xl">
              <span className="lg:block">
                <TitleWords text={hero.titleLead} animate={animateTitle} startIndex={0} />
              </span>{" "}
              <span className="lg:block">
                <TitleWords text="que" animate={animateTitle} startIndex={leadWords} />{" "}
                <TitleWords
                  text={hero.titleHighlight}
                  animate={animateTitle}
                  startIndex={leadWords + 1}
                  gradient
                />
              </span>{" "}
              <span className="lg:block">
                <TitleWords
                  text={hero.titleTail}
                  animate={animateTitle}
                  startIndex={leadWords + 1 + highlightWords}
                />
              </span>
            </h1>

            <p
              {...rise(
                2,
                "max-w-xl text-base leading-relaxed text-foreground/75 text-pretty sm:text-lg",
              )}
            >
              {hero.subtitle}
            </p>
          </div>

          {/* CTAs (hover premium: lift sutil + glow controlado, accesible) */}
          <div
            {...rise(3, "flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row")}
          >
            <Button
              asChild
              variant="brand"
              size="2xl"
              className="w-full transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_14px_34px_-12px_rgba(37,99,235,0.7)] motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:w-auto"
            >
              <TrackedLink
                href="#contacto"
                trackProps={{ location: "hero", target: "contacto" }}
              >
                {cta.primary}
                <ArrowRight data-icon="inline-end" />
              </TrackedLink>
            </Button>
            {/* Sin w-full, a diferencia del primario. Regla del design-director:
                ancho completo SOLO para la acción primaria de la pantalla; el
                secundario se ajusta al contenido. "Ver ejemplos" son 11
                caracteres estirados a 272px en un teléfono — el caso exacto que
                el owner rechazó. Y de paso la diferencia de ancho es la señal
                de jerarquía más legible en mobile, gratis. */}
            <Button
              asChild
              variant="brand-outline"
              size="2xl"
              className="transition-[transform,border-color,background-color] duration-200 ease-out hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            >
              <TrackedLink
                href="#casos"
                trackProps={{ location: "hero", target: "casos" }}
              >
                {cta.secondary}
              </TrackedLink>
            </Button>
          </div>

          {/* MOBILE: el mismo vórtice, horneado (39KB) — la primera pantalla del
              sitio tenía fondo pero no protagonista. Va en el FLUJO (no tapa el
              H1) y respira con su propio halo. Sin canvas ni JS.
              2026-07-22: re-horneado con el violeta en 3.0 (la dosis vigente en
              desktop). El asset anterior venía de la luz a 6.5 y mostraba en
              mobile justo el violeta que se había sacado del 3D — 2.3% de
              píxeles violeta saturado contra 0.2% ahora. */}
          <div
            aria-hidden="true"
            {...rise(4, "relative -my-2 w-[78%] max-w-[19rem] lg:hidden")}
          >
            <div
              className="absolute inset-0 -m-6 rounded-full"
              style={{
                background:
                  "radial-gradient(circle, rgba(122,160,220,0.16), transparent 68%)",
              }}
            />
            <Image
              src="/visual-assets/syntra/hero/vortice-poster.webp"
              alt=""
              width={708}
              height={716}
              priority
              // El elemento está topeado a max-w-[19rem]: arriba de ~440px de
              // viewport mide 304px fijos, no 78vw. Con el 78vw suelto el
              // browser pedía la variante w=1920 en tablet para pintar 304px.
              sizes="(max-width: 440px) 78vw, 304px"
              className="relative h-auto w-full"
            />
          </div>

          {/* Placa de vidrio (capability rail v2): UN objeto monolítico — un estrato
              extraído del edificio del asset. Segmentos separados por costuras de luz
              (no cajas), canto superior iluminado, sheen especular lento (mismo
              lenguaje que el light sweep del asset) y cola de fusión hacia el
              edificio en lg. Solo transform/opacity → CLS 0, LCP intacto. */}
          {/* md:max-w-2xl: en tablet la placa quedaba a 448px debajo de un H1
              y un subtítulo de 720px — un bloque centrado suelto. A 672px
              acompaña el ancho de la columna de texto. */}
          <div
            {...rise(4, "relative w-full max-w-md md:max-w-2xl lg:max-w-xl")}
          >
            <div
              className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.07] via-white/[0.04] to-white/[0.02] shadow-[0_24px_60px_-28px_rgba(0,0,0,0.75)] backdrop-blur-md"
            >
              {/* Canto superior iluminado (el filo del estrato) */}
              <div
                aria-hidden="true"
                className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-white/10 via-white/35 to-white/60"
              />
              {/* Base interna: gradiente frío que asienta la placa contra el scrim */}
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-[radial-gradient(150%_180%_at_100%_-30%,rgba(126,164,224,0.13),rgba(96,165,250,0.05)_45%,transparent_72%)]"
              />

              <div className="relative grid sm:grid-cols-3">
                {hero.capabilities.map((cap) => {
                  const Icon = getIcon(cap.icon);
                  return (
                    <div
                      key={cap.title}
                      className="group relative p-5 text-left transition-colors duration-300 ease-out before:absolute before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent before:transition-opacity first:before:hidden hover:bg-white/[0.05] before:inset-x-5 before:top-0 before:h-px sm:before:inset-x-auto sm:before:inset-y-4 sm:before:left-0 sm:before:h-auto sm:before:w-px sm:before:bg-gradient-to-b sm:hover:before:via-[#60a5fa]/60"
                    >
                      <Icon
                        className="size-5 text-[#60a5fa] transition-colors duration-300 ease-out group-hover:text-[#e7c8a0]"
                        aria-hidden="true"
                      />
                      <p className="mt-2.5 text-base font-semibold text-foreground">
                        {cap.title}
                      </p>
                      <p className="mt-1 text-sm leading-snug text-muted-foreground">
                        {cap.copy}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Columna derecha: vacía a propósito — la esfera-red 3D del fondo vive en
            esta zona (el scrim la deja despejada). */}
        <div className="hidden lg:block" aria-hidden="true" />
      </div>
    </Section>
  );
}

export { HeroSection };
