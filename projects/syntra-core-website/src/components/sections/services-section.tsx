import { Check } from "lucide-react";

import { services, siteConfig } from "@/config/site";
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
 * ServicesSection — las 3 líneas de servicio como cards premium con features.
 * Content-driven (config/site.ts). Server Component + wrappers de animación.
 */
function ServicesSection() {
  const { eyebrow, title, subtitle } = siteConfig.sections.services;

  return (
    <Section id="servicios" className="bg-depth-raised">
      <BlurReveal>
        <SectionHeading eyebrow={eyebrow} title={title} subtitle={subtitle} />
      </BlurReveal>

      <Stagger className="mt-14 grid gap-6 md:grid-cols-3">
        {services.map((service) => {
          const Icon = getIcon(service.icon);
          return (
            <StaggerItem key={service.id} className="h-full">
              <Card className="group h-full hover:border-accent-primary/40">
                <CardHeader>
                  <span className="mb-2 inline-flex size-12 items-center justify-center rounded-xl border border-border-strong bg-surface-2 text-muted-foreground transition-all duration-200 group-hover:scale-105 group-hover:border-accent-primary/40 group-hover:text-accent-secondary">
                    <Icon className="size-6" aria-hidden="true" />
                  </span>
                  <CardTitle>{service.title}</CardTitle>
                  <CardDescription>{service.description}</CardDescription>
                </CardHeader>
                <CardContent className="mt-2">
                  <ul className="flex flex-col gap-2.5">
                    {service.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-start gap-2.5 text-sm text-muted-foreground"
                      >
                        <Check
                          className="mt-0.5 size-4 shrink-0 text-brand-cyan"
                          aria-hidden="true"
                        />
                        {feature}
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

export { ServicesSection };
