"use client";

import { ArrowRight } from "lucide-react";

import { servicesConsultCta } from "@/config/site";
import { BlurReveal } from "@/components/animations/blur-reveal";

/**
 * ServicesDecide — cierre consultivo de Servicios (pedido owner 2026-07-08: el bloque
 * de síntomas "por dónde empezar" se eliminó — era redundante con los CTA por card del
 * showcase y quedaba pobre). Queda SOLO el cierre full-width sin card: pregunta en
 * tipografía grande + microcopy + botón sólido, alineado al ancho de las cards.
 *
 * Content-driven (site.ts). Dark-first · reduced-motion safe · CLS 0.
 */
function ServicesDecide() {
  return (
    // Sin max-w-5xl: este bloque abre con un border-t, o sea una línea NÍTIDA.
    // Centrado a 1024px dentro del Container (1088) nacía 32px a la derecha del
    // H2 de su propia sección — el casi-acierto que se lee como descuido. Ahora
    // la regla arranca exactamente donde arranca el título.
    <div className="mt-16 lg:mt-20">
      <BlurReveal>
        <div className="flex flex-col gap-6 border-t border-border/50 pt-10 sm:flex-row sm:items-center sm:justify-between sm:gap-10 lg:pt-12">
          <div className="max-w-xl">
            <p className="font-heading text-2xl font-bold tracking-tight text-balance sm:text-3xl">
              {servicesConsultCta.question}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-pretty text-muted-foreground">
              {servicesConsultCta.microcopy}
            </p>
          </div>
          <a
            href={servicesConsultCta.href}
            className="group inline-flex shrink-0 items-center gap-2 rounded-xl bg-foreground px-5 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {servicesConsultCta.button}
            <ArrowRight
              className="size-4 transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </a>
        </div>
      </BlurReveal>
    </div>
  );
}

export { ServicesDecide };
