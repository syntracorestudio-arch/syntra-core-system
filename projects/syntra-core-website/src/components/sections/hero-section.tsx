import { ArrowRight, Check } from "lucide-react";

import { siteConfig } from "@/config/site";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/layout/section";
import { GlowOrb } from "@/components/shared/glow-orb";
import { TrackedLink } from "@/components/shared/tracked-link";
import { HeroVisual } from "@/components/marketing/hero/hero-visual";
import { BlurReveal } from "@/components/animations/blur-reveal";
import { FadeIn } from "@/components/animations/fade-in";

/**
 * HeroSection — primera impresión. Contiene el <h1> único de la página.
 * Server Component; la animación se delega a wrappers client. Content-driven.
 */
function HeroSection() {
  const { hero, cta } = siteConfig;

  return (
    <Section
      id="inicio"
      className="flex min-h-[92vh] items-center justify-center overflow-hidden pt-16"
    >
      {/* Capa de profundidad (decorativa) */}
      <GlowOrb
        tone="electric"
        size="lg"
        className="-top-32 left-1/2 -translate-x-1/2"
      />
      <GlowOrb tone="cyan" size="sm" className="-bottom-24 -right-24" />

      {/* Layout 2 columnas (desktop) / stack (mobile) */}
      <div className="relative grid w-full items-center gap-12 lg:grid-cols-2 lg:gap-16">
        {/* Columna izquierda: contenido — espaciado escalonado (badge+H1 agrupados) */}
        <div className="flex flex-col items-center gap-5 text-center lg:items-start lg:text-left">
          <BlurReveal>
            <Badge variant="neutral">{hero.badge}</Badge>
          </BlurReveal>

          <BlurReveal delay={0.08}>
            <h1 className="font-heading text-4xl font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl">
              {hero.titleLead}{" "}
              <span className="text-gradient-brand">{hero.titleHighlight}</span>{" "}
              {hero.titleTail}
            </h1>
          </BlurReveal>

          <FadeIn delay={0.16} className="mt-2">
            <p className="max-w-xl text-base leading-relaxed text-muted-foreground text-pretty sm:text-lg lg:max-w-md">
              {hero.subtitle}
            </p>
          </FadeIn>

          <FadeIn
            delay={0.24}
            className="mt-3 flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row"
          >
            <Button asChild variant="brand" size="2xl" className="w-full sm:w-auto">
              <TrackedLink
                href="#contacto"
                trackProps={{ location: "hero", target: "contacto" }}
              >
                {cta.primary}
                <ArrowRight data-icon="inline-end" />
              </TrackedLink>
            </Button>
            <Button
              asChild
              variant="brand-outline"
              size="2xl"
              className="w-full sm:w-auto"
            >
              <TrackedLink
                href="#servicios"
                trackProps={{ location: "hero", target: "servicios" }}
              >
                {cta.secondary}
              </TrackedLink>
            </Button>
          </FadeIn>

          <FadeIn
            delay={0.32}
            className="mt-2 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-4 lg:justify-start"
          >
            {hero.proof.map((item) => (
              <span
                key={item}
                className="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <Check className="size-4 text-brand-cyan" aria-hidden="true" />
                {item}
              </span>
            ))}
          </FadeIn>
        </div>

        {/* Columna derecha: HeroVisual estático */}
        <FadeIn delay={0.2} className="w-full">
          <HeroVisual />
        </FadeIn>
      </div>
    </Section>
  );
}

export { HeroSection };
