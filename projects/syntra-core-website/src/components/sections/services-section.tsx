import { siteConfig } from "@/config/site";
import { Section } from "@/components/layout/section";
import { Container } from "@/components/layout/container";
import { SectionHeading } from "@/components/shared/section-heading";
import { BlurReveal } from "@/components/animations/blur-reveal";
import { ServicesShowcase } from "@/components/marketing/servicios/services-showcase";
import { ServicesDecide } from "@/components/marketing/servicios/services-decide";
import { SectionAtmosphere } from "@/components/marketing/living/section-atmosphere";

/**
 * ServicesSection — Servicios v5 "Showcase imagery-led" (dirección final del owner).
 *
 * Server Component: sin estado ni hooks — solo compone. Sobre la atmósfera unificada
 * (CSS puro, acento electric) que reemplazó al arco 3D:
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
      {/* === Fondo unificado: atmósfera CSS (acento electric), sin canvas === */}
      <SectionAtmosphere accent="electric" />

      <Container className="relative z-10">
        <BlurReveal>
          <SectionHeading eyebrow={eyebrow} title={title} subtitle={subtitle} align="left" />
        </BlurReveal>

        {/* === Showcase 2×2 imagery-led + circuito central, atmósfera CSS detrás === */}
        <ServicesShowcase />

        {/* === Cierre: por dónde empezar + CTA consultivo === */}
        <ServicesDecide />
      </Container>
    </Section>
  );
}

export { ServicesSection };
