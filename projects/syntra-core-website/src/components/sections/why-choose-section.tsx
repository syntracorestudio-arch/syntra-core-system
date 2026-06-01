import { siteConfig, whyChoose } from "@/config/site";
import { getIcon } from "@/lib/icons";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Section } from "@/components/layout/section";
import { SectionHeading } from "@/components/shared/section-heading";
import { BlurReveal } from "@/components/animations/blur-reveal";
import { Stagger, StaggerItem } from "@/components/animations/stagger";

/**
 * WhyChooseSection — pilares de diferenciación ("¿Por qué elegir SYNTRA?").
 * Reemplaza la antigua sección de Beneficios. Server Component.
 */
function WhyChooseSection() {
  const { eyebrow, title, subtitle } = siteConfig.sections.whyChoose;

  return (
    <Section id="por-que">
      <BlurReveal>
        <SectionHeading eyebrow={eyebrow} title={title} subtitle={subtitle} />
      </BlurReveal>

      <Stagger className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {whyChoose.map((pillar) => {
          const Icon = getIcon(pillar.icon);
          return (
            <StaggerItem key={pillar.id} className="h-full">
              <Card className="h-full gap-4">
                <span className="inline-flex size-11 items-center justify-center rounded-xl border border-brand-electric/20 bg-brand-electric/10 text-brand-cyan">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <CardTitle className="text-base">{pillar.title}</CardTitle>
                <CardDescription>{pillar.description}</CardDescription>
              </Card>
            </StaggerItem>
          );
        })}
      </Stagger>
    </Section>
  );
}

export { WhyChooseSection };
