import { applicationsNote, siteConfig, useCases } from "@/config/site";
import { getIcon } from "@/lib/icons";
import { Section } from "@/components/layout/section";
import { SectionHeading } from "@/components/shared/section-heading";
import { BlurReveal } from "@/components/animations/blur-reveal";
import {
  ApplicationSelector,
  type ApplicationItem,
} from "@/components/marketing/aplicaciones/application-selector";

/**
 * UseCasesSection — "Aplicaciones": escenarios de aplicación por rubro (TASK-010C).
 *
 * Reemplaza el formato Antes/Después por un rail de pills + panel de escenario
 * (situación típica → lo que diseñaríamos → qué incluiría), en tono condicional
 * y honesto (no son casos reales). Los íconos se resuelven en este Server
 * Component y se pasan ya renderizados al island. Conserva el ancla #casos.
 */
function UseCasesSection() {
  const { eyebrow, title, subtitle } = siteConfig.sections.useCases;

  const items: ApplicationItem[] = useCases.map((useCase) => {
    const Icon = getIcon(useCase.icon);
    return {
      id: useCase.id,
      title: useCase.title,
      icon: <Icon className="size-4" aria-hidden="true" />,
      situacion: useCase.pain,
      sistema: useCase.description,
      capacidades: useCase.deliverables,
      flow: useCase.flow,
    };
  });

  return (
    <Section id="casos">
      <BlurReveal>
        <SectionHeading eyebrow={eyebrow} title={title} subtitle={subtitle} />
      </BlurReveal>

      <ApplicationSelector
        items={items}
        note={applicationsNote}
        className="mx-auto mt-12 max-w-5xl"
      />
    </Section>
  );
}

export { UseCasesSection };
