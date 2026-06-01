import { siteConfig, workflow } from "@/config/site";
import { getIcon } from "@/lib/icons";
import { Section } from "@/components/layout/section";
import { SectionHeading } from "@/components/shared/section-heading";
import { BlurReveal } from "@/components/animations/blur-reveal";
import { Stagger, StaggerItem } from "@/components/animations/stagger";

/**
 * WorkflowSection — proceso de trabajo como timeline de 4 pasos.
 * Horizontal con línea conectora en desktop, vertical en mobile. Content-driven.
 */
function WorkflowSection() {
  const { eyebrow, title, subtitle } = siteConfig.sections.workflow;

  return (
    <Section id="proceso">
      <BlurReveal>
        <SectionHeading eyebrow={eyebrow} title={title} subtitle={subtitle} />
      </BlurReveal>

      <Stagger className="relative mt-16">
        {/* Línea conectora (solo desktop, detrás de los íconos) */}
        <div
          aria-hidden="true"
          className="absolute top-7 right-0 left-0 hidden h-px bg-gradient-to-r from-transparent via-border to-transparent md:block"
        />

        <div className="grid gap-10 md:grid-cols-4 md:gap-6">
          {workflow.map((item) => {
            const Icon = getIcon(item.icon);
            return (
              <StaggerItem
                key={item.step}
                className="relative flex flex-col items-center text-center"
              >
                <span className="relative z-10 inline-flex size-14 items-center justify-center rounded-2xl border border-border-strong bg-surface-2 text-muted-foreground">
                  <Icon className="size-6" aria-hidden="true" />
                </span>
                <span className="mt-4 font-accent text-xs tracking-widest text-muted-foreground">
                  PASO {String(item.step).padStart(2, "0")}
                </span>
                <h3 className="mt-1 font-heading text-lg font-semibold tracking-tight">
                  {item.title}
                </h3>
                <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
                  {item.description}
                </p>
              </StaggerItem>
            );
          })}
        </div>
      </Stagger>
    </Section>
  );
}

export { WorkflowSection };
