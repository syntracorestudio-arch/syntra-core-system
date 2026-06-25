import { applicationsNote, siteConfig, useCases } from "@/config/site";
import { getIcon } from "@/lib/icons";
import { Section } from "@/components/layout/section";
import { SectionHeading } from "@/components/shared/section-heading";
import { BlurReveal } from "@/components/animations/blur-reveal";
import { CasosBackdrop } from "@/components/marketing/aplicaciones/casos-backdrop";
import {
  ApplicationSelector,
  type ApplicationItem,
} from "@/components/marketing/aplicaciones/application-selector";

/**
 * UseCasesSection — "Casos / Aplicaciones" (web viva, reference-lock casos.md).
 * Fondo vivo propio "Campo de señales" (<CasosBackdrop>): trazos cálidos que derivan
 * y convergen+enfrían a electric abajo, anticipando el cable de Proceso. El selector
 * elige el rubro y se compone un split editorial — texto a un lado, escena de chat
 * image-led del rubro al otro (conservados intactos). Heading a la izquierda para el
 * ritmo editorial. Server Component; los íconos se resuelven acá.
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
      tagline: useCase.tagline,
      flow: useCase.flow,
    };
  });

  return (
    <Section id="casos" contained={false} className="relative overflow-hidden">
      {/* Fondo vivo "Campo de señales" (reference-lock casos.md): trazos cálidos que
          convergen y se enfrían a electric abajo, anticipando el cable de Proceso. */}
      <CasosBackdrop />

      <div className="relative z-10 mx-auto w-full max-w-6xl px-6 lg:max-w-7xl lg:px-8">
        <BlurReveal>
          <SectionHeading
            eyebrow={eyebrow}
            title={title}
            subtitle={subtitle}
            align="left"
          />
        </BlurReveal>

        <ApplicationSelector items={items} note={applicationsNote} className="mt-10" />
      </div>
    </Section>
  );
}

export { UseCasesSection };
