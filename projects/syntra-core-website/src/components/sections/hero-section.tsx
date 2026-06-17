import { ArrowRight, Check } from "lucide-react";

import { siteConfig } from "@/config/site";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/layout/section";
import { TrackedLink } from "@/components/shared/tracked-link";
import { HeroVisual } from "@/components/marketing/hero/hero-visual";
import { BlurReveal } from "@/components/animations/blur-reveal";
import { FadeIn } from "@/components/animations/fade-in";

/**
 * HeroSection — primera impresión. Contiene el <h1> único de la página.
 * Server Component; la animación se delega a wrappers client. Content-driven.
 *
 * Layout (WEB-HERO-A): la Section ya aporta py-20/28/32; el alto lo da el
 * contenido + un piso lg, no un min-h-[92vh] que dejaba aire muerto. La columna
 * izquierda se ordena en bloques (mensaje / acción / prueba) con el ritmo
 * gobernado desde los contenedores, sin mt-* sueltos. Los proof-points son una
 * barra de confianza anclada con divisor, no un agregado. La profundidad la da
 * el chasis del HeroVisual (no GlowOrbs sueltos) → un solo foco por viewport.
 */
function HeroSection() {
  const { hero, cta } = siteConfig;

  return (
    <Section
      id="inicio"
      className="flex items-center justify-center overflow-hidden lg:min-h-[40rem]"
    >
      {/* Layout 2 columnas (desktop) / stack (mobile, texto primero → CTAs sobre el fold) */}
      <div className="grid w-full items-center gap-10 lg:grid-cols-2 lg:gap-16">
        {/* Columna izquierda: contenido en bloques (mensaje / acción / prueba) */}
        <div className="flex flex-col items-center gap-7 text-center lg:items-start lg:text-left">
          {/* Bloque mensaje: badge + H1 + subtítulo, ritmo propio */}
          <div className="flex flex-col items-center gap-5 lg:items-start">
            <BlurReveal>
              <Badge
                variant="neutral"
                className="max-w-full whitespace-normal text-balance text-center leading-snug"
              >
                {hero.badge}
              </Badge>
            </BlurReveal>

            <BlurReveal delay={0.08}>
              <h1 className="font-heading text-4xl font-bold tracking-tight text-balance sm:text-5xl lg:max-w-[15ch] lg:text-6xl">
                {hero.titleLead}{" "}
                <span className="text-gradient-brand">{hero.titleHighlight}</span>{" "}
                {hero.titleTail}
              </h1>
            </BlurReveal>

            <FadeIn delay={0.16}>
              <p className="max-w-xl text-base leading-relaxed text-muted-foreground text-pretty sm:text-lg lg:max-w-md">
                {hero.subtitle}
              </p>
            </FadeIn>
          </div>

          {/* Bloque acción: CTAs */}
          <FadeIn
            delay={0.24}
            className="flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row"
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

          {/* Bloque prueba: barra de confianza anclada con divisor (no "agregada") */}
          <FadeIn delay={0.32} className="w-full border-t border-border/60 pt-6">
            <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 lg:justify-start">
              {hero.proof.map((item) => (
                <li
                  key={item}
                  className="flex items-center gap-2 text-sm text-muted-foreground"
                >
                  <Check className="size-4 text-brand-cyan" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </FadeIn>
        </div>

        {/* Columna derecha: HeroVisual con chasis premium (su propio frame + atmósfera) */}
        <FadeIn delay={0.2} className="w-full">
          <HeroVisual />
        </FadeIn>
      </div>
    </Section>
  );
}

export { HeroSection };
