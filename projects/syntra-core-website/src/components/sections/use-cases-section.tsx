import { Check } from "lucide-react";

import { siteConfig, useCases } from "@/config/site";
import { getIcon } from "@/lib/icons";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Section } from "@/components/layout/section";
import { SectionHeading } from "@/components/shared/section-heading";
import { BlurReveal } from "@/components/animations/blur-reveal";
import { Stagger, StaggerItem } from "@/components/animations/stagger";

/**
 * UseCasesSection — casos de uso por industria (escenario problema → solución).
 * Content-driven, sin métricas ni casos inventados. Server Component.
 */
function UseCasesSection() {
  const { eyebrow, title, subtitle } = siteConfig.sections.useCases;

  return (
    <Section id="casos">
      <BlurReveal>
        <SectionHeading eyebrow={eyebrow} title={title} subtitle={subtitle} />
      </BlurReveal>

      <Stagger className="mt-14 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {useCases.map((useCase) => {
          const Icon = getIcon(useCase.icon);
          return (
            <StaggerItem key={useCase.id} className="h-full">
              <Card className="h-full transition-colors duration-300 hover:border-brand-cyan/30">
                <CardHeader>
                  <span className="mb-2 inline-flex size-12 items-center justify-center rounded-xl border border-brand-electric/20 bg-brand-electric/10 text-brand-cyan">
                    <Icon className="size-6" aria-hidden="true" />
                  </span>
                  <CardTitle>{useCase.title}</CardTitle>
                  <CardDescription>{useCase.description}</CardDescription>
                </CardHeader>
                <CardContent className="mt-2">
                  <ul className="flex flex-col gap-2.5">
                    {useCase.deliverables.map((item) => (
                      <li
                        key={item}
                        className="flex items-start gap-2.5 text-sm text-muted-foreground"
                      >
                        <Check
                          className="mt-0.5 size-4 shrink-0 text-brand-cyan"
                          aria-hidden="true"
                        />
                        {item}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </StaggerItem>
          );
        })}
      </Stagger>
    </Section>
  );
}

export { UseCasesSection };
