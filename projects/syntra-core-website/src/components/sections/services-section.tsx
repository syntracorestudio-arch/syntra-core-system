import { siteConfig } from "@/config/site";
import { Section } from "@/components/layout/section";
import { Container } from "@/components/layout/container";
import { SectionHeading } from "@/components/shared/section-heading";
import { BlurReveal } from "@/components/animations/blur-reveal";
import { ServicesShowcase } from "@/components/marketing/servicios/services-showcase";
import { ServicesDecide } from "@/components/marketing/servicios/services-decide";
import { DeferredLivingBackground } from "@/components/marketing/living/deferred-living-background";

/**
 * ServicesSection — Servicios v5 "Showcase imagery-led" (dirección final del owner).
 *
 * Server Component: sin estado ni hooks — solo compone. Sobre el fondo vivo 3D (arco)
 * que se conserva intacto:
 *   1. heading (BlurReveal + SectionHeading, con el copy nuevo de siteConfig),
 *   2. <ServicesShowcase /> — grid 2×2 de paneles liderados por render 3D + circuito
 *      central hacia un núcleo,
 *   3. <ServicesDecide /> — por dónde empezar + CTA consultivo (filas sin cajas,
 *      contrasta con los paneles ricos).
 *
 * reduced-motion safe; CLS 0 (sin animar layout).
 */
function ServicesSection() {
  const { eyebrow, title, subtitle } = siteConfig.sections.services;

  return (
    <Section
      id="servicios"
      contained={false}
      className="relative overflow-hidden py-16 sm:py-24 lg:py-28"
    >
      {/* === Fondo full-bleed: base gris ahumado + arco 3D vivo (debajo del contenido) === */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(75% 60% at 78% 8%, #3a3e47 0%, transparent 55%)," +
              "linear-gradient(180deg, #1b1d22 0%, #121317 60%, #0e0f12 100%)",
          }}
        />
        <DeferredLivingBackground variant="servicios" />
        <div className="sys-canvas-grid absolute inset-0 opacity-20" />
      </div>

      {/* Scrim de legibilidad: oscurece la izquierda (texto) + vignette inferior,
          por encima del arco/haces pero debajo del contenido. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[5]"
        style={{
          background:
            "linear-gradient(to right, rgba(8,9,12,0.62) 0%, rgba(8,9,12,0.28) 42%, transparent 68%)," +
            "linear-gradient(to bottom, transparent 55%, rgba(8,9,12,0.45) 100%)",
        }}
      />

      {/* Vignette en bordes (foco/profundidad) + fundido sup/inf (cose con vecinas). */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[6]"
        style={{
          background:
            "radial-gradient(125% 95% at 50% 45%, transparent 55%, rgba(6,7,9,0.55) 100%)," +
            "linear-gradient(to bottom, rgba(6,7,9,0.92) 0%, transparent 13%, transparent 87%, rgba(6,7,9,0.95) 100%)",
        }}
      />

      <Container className="relative z-10">
        <BlurReveal>
          <SectionHeading eyebrow={eyebrow} title={title} subtitle={subtitle} align="left" />
        </BlurReveal>

        {/* === Showcase 2×2 imagery-led + circuito central, arco 3D detrás === */}
        <ServicesShowcase />

        {/* === Cierre: por dónde empezar + CTA consultivo === */}
        <ServicesDecide />
      </Container>
    </Section>
  );
}

export { ServicesSection };
