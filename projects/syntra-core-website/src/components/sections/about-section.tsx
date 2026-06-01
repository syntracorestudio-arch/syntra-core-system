import { aboutPillars, siteConfig } from "@/config/site";
import { getIcon } from "@/lib/icons";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Section } from "@/components/layout/section";
import { SectionHeading } from "@/components/shared/section-heading";
import { BlurReveal } from "@/components/animations/blur-reveal";
import { Stagger, StaggerItem } from "@/components/animations/stagger";

/**
 * AboutSection — "Quiénes somos". Mismo lenguaje visual que Servicios:
 * SectionHeading centrado + grid de 3 cards. Server Component.
 */
function AboutSection() {
  const { eyebrow, title, subtitle } = siteConfig.sections.about;

  return (
    <Section id="nosotros" className="bg-depth-raised">
      <BlurReveal>
        <SectionHeading eyebrow={eyebrow} title={title} subtitle={subtitle} />
      </BlurReveal>

      <Stagger className="mt-14 grid gap-6 md:grid-cols-3">
        {aboutPillars.map((pillar) => {
          const Icon = getIcon(pillar.icon);
          return (
            <StaggerItem key={pillar.id} className="h-full">
              <Card className="group h-full hover:border-accent-primary/40">
                <CardHeader>
                  <span className="mb-2 inline-flex size-12 items-center justify-center rounded-xl border border-border-strong bg-surface-2 text-muted-foreground transition-all duration-200 group-hover:scale-105 group-hover:border-accent-primary/40 group-hover:text-accent-secondary">
                    <Icon className="size-6" aria-hidden="true" />
                  </span>
                  <CardTitle>{pillar.title}</CardTitle>
                  <CardDescription>{pillar.description}</CardDescription>
                </CardHeader>
              </Card>
            </StaggerItem>
          );
        })}
      </Stagger>
    </Section>
  );
}

export { AboutSection };
