import { aboutPillars, aboutStatement, siteConfig } from "@/config/site";
import { getIcon } from "@/lib/icons";
import { Section } from "@/components/layout/section";
import { SectionHeading } from "@/components/shared/section-heading";
import { BlurReveal } from "@/components/animations/blur-reveal";
import { Stagger, StaggerItem } from "@/components/animations/stagger";

/**
 * AboutSection — "Quiénes somos" como Operating Principles (TASK-008 + 008B).
 *
 * Layout editorial asimétrico: izquierda = statement de identidad (eyebrow +
 * título + lead + frase-firma); derecha = 4 principios operativos numerados
 * (01–04) con hairlines e ícono de acento inline. Compactado para densidad
 * intencional (008B). Rompe con el grid de cards de Servicios. Server Component.
 */
function AboutSection() {
  const { eyebrow, title, subtitle } = siteConfig.sections.about;

  return (
    <Section id="nosotros" className="bg-depth-raised py-16 sm:py-20 lg:py-24">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-12">
        {/* === Statement de identidad (izquierda) === */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <BlurReveal>
            <SectionHeading
              align="left"
              eyebrow={eyebrow}
              title={title}
              subtitle={subtitle}
            />
            {/* Frase-firma editorial: cierra la identidad y da cuerpo a la columna */}
            <p className="mt-6 font-heading text-lg font-semibold tracking-tight text-foreground sm:text-xl">
              {aboutStatement}
            </p>
          </BlurReveal>
        </div>

        {/* === Principios operativos (derecha) === */}
        <Stagger className="flex flex-col lg:border-l lg:border-border lg:pl-12">
          {aboutPillars.map((pillar, i) => {
            const Icon = getIcon(pillar.icon);
            return (
              <StaggerItem key={pillar.id}>
                <div className="group grid grid-cols-[auto_1fr] gap-x-5 border-t border-border py-7 first:border-t-0 first:pt-0 sm:gap-x-7">
                  {/* Número editorial */}
                  <span className="font-heading text-3xl font-semibold tabular-nums text-muted-foreground/50 transition-colors duration-200 group-hover:text-brand-cyan sm:text-4xl">
                    {String(i + 1).padStart(2, "0")}
                  </span>

                  {/* Título (con ícono de acento inline) + descripción */}
                  <div className="flex flex-col gap-1.5">
                    <h3 className="flex items-center gap-2.5 font-heading text-lg font-semibold tracking-tight">
                      <Icon
                        className="size-4 shrink-0 text-brand-cyan/70 transition-colors duration-200 group-hover:text-brand-cyan"
                        aria-hidden="true"
                      />
                      {pillar.title}
                    </h3>
                    <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
                      {pillar.description}
                    </p>
                  </div>
                </div>
              </StaggerItem>
            );
          })}
        </Stagger>
      </div>
    </Section>
  );
}

export { AboutSection };
