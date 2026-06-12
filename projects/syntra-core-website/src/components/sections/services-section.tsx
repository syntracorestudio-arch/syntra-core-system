import { Check } from "lucide-react";

import { services, siteConfig } from "@/config/site";
import { getIcon } from "@/lib/icons";
import { Section } from "@/components/layout/section";
import { SectionHeading } from "@/components/shared/section-heading";
import { BlurReveal } from "@/components/animations/blur-reveal";
import { Stagger, StaggerItem } from "@/components/animations/stagger";
import { ServiceDemoWeb } from "@/components/marketing/servicios/service-demo-web";
import { ServiceDemoAutomation } from "@/components/marketing/servicios/service-demo-automation";
import { ServiceDemoChat } from "@/components/marketing/servicios/service-demo-chat";

/** Resuelve la demo estática según el id del servicio. */
function ServiceDemo({ id }: { id: string }) {
  switch (id) {
    case "web":
      return <ServiceDemoWeb />;
    case "automation":
      return <ServiceDemoAutomation />;
    case "ia":
      return <ServiceDemoChat />;
    default:
      return null;
  }
}

/**
 * ServicesSection — las 3 líneas de servicio en layout zig-zag full-width.
 * Cada unidad alterna texto/demo en desktop; en mobile la demo va primero
 * (gancho visual). Content-driven (config/site.ts). Las demos son estáticas
 * (Server Components, sin motion); el movimiento avanzado es WEB-009B.
 */
function ServicesSection() {
  const { eyebrow, title, subtitle } = siteConfig.sections.services;

  return (
    <Section id="servicios" className="bg-depth-raised">
      <BlurReveal>
        <SectionHeading
          eyebrow={eyebrow}
          title={title}
          subtitle={subtitle}
          align="left"
        />
      </BlurReveal>

      <div className="mt-14 space-y-16 lg:space-y-20">
        {services.map((service, index) => {
          const Icon = getIcon(service.icon);
          const isEven = index % 2 === 0;
          // Mobile (DOM): demo primero, texto después.
          // Desktop par: texto izquierda / demo derecha. Impar: demo izquierda / texto derecha.
          const demoOrder = isEven ? "lg:order-2" : "lg:order-1";
          const textOrder = isEven ? "lg:order-1" : "lg:order-2";

          return (
            <BlurReveal key={service.id}>
              <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
                {/* Columna de demo (primero en mobile como gancho visual) */}
                <div className={demoOrder}>
                  <ServiceDemo id={service.id} />
                </div>

                {/* Columna de texto */}
                <div className={textOrder}>
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-2 text-muted-foreground/70">
                      <Icon className="size-4" aria-hidden="true" />
                      <span className="font-accent text-xs uppercase tracking-widest">
                        {service.tag}
                      </span>
                    </div>
                    <h3 className="font-heading text-xl font-semibold tracking-tight text-balance sm:text-2xl">
                      {service.title}
                    </h3>
                    <p className="leading-relaxed text-muted-foreground text-pretty">
                      {service.description}
                    </p>
                    <Stagger className="mt-1 flex flex-col gap-2.5">
                      {service.features.map((feature) => (
                        <StaggerItem
                          key={feature}
                          className="flex items-start gap-2.5 text-sm text-muted-foreground"
                        >
                          <Check
                            className="mt-0.5 size-4 shrink-0 text-brand-cyan"
                            aria-hidden="true"
                          />
                          {feature}
                        </StaggerItem>
                      ))}
                    </Stagger>
                  </div>
                </div>
              </div>
            </BlurReveal>
          );
        })}
      </div>
    </Section>
  );
}

export { ServicesSection };
