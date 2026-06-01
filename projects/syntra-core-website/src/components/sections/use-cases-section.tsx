import { siteConfig, useCases } from "@/config/site";
import { getIcon } from "@/lib/icons";
import { Section } from "@/components/layout/section";
import { SectionHeading } from "@/components/shared/section-heading";
import { BlurReveal } from "@/components/animations/blur-reveal";
import { IndustryBand } from "@/components/marketing/para-quien/industry-band";

/**
 * UseCasesSection — "Pensado para tu rubro": 4 bandas full-width antes/después
 * con reveal al entrar en viewport. Content-driven (config/site.ts).
 * Conserva el ancla #casos (navegación del navbar).
 *
 * El rótulo (ícono + nombre) se arma acá (Server Component, mismo patrón que
 * Servicios) y se pasa como `label` a IndustryBand, que es Client.
 */
function UseCasesSection() {
  const { eyebrow, title, subtitle } = siteConfig.sections.useCases;

  return (
    <Section id="casos">
      <BlurReveal>
        <SectionHeading eyebrow={eyebrow} title={title} subtitle={subtitle} />
      </BlurReveal>

      <div className="mx-auto mt-16 flex max-w-5xl flex-col gap-12 lg:gap-14">
        {useCases.map((useCase, index) => {
          const Icon = getIcon(useCase.icon);
          return (
            <IndustryBand
              key={useCase.id}
              index={index}
              label={
                <span className="flex items-center gap-3">
                  <span className="inline-flex size-11 items-center justify-center rounded-xl border border-border bg-secondary/40 text-muted-foreground">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <span className="font-heading text-lg font-semibold tracking-tight">
                    {useCase.title}
                  </span>
                </span>
              }
              pain={useCase.pain}
              solutions={useCase.deliverables}
              reversed={index % 2 === 1}
            />
          );
        })}
      </div>
    </Section>
  );
}

export { UseCasesSection };
