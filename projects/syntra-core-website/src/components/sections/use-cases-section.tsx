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
 * UseCasesSection — "Casos / Aplicaciones" (VISUAL-RESET, ruta Editorial Split +
 * Industry Object Scene). Full-bleed con campo de luz propio (spotlight
 * asimétrico): NO una card central con dashboard adentro. El selector elige el
 * rubro y abajo se compone un split editorial — texto a un lado, OBJETO de
 * producto del rubro flotando al otro. Heading alineado a la izquierda para el
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
      {/* Campo de luz propio de la sección: spotlight CÁLIDO asimétrico (lado de
          la ficha de papel), para no reforzar el azul. Distinto del Hero
          (gradient + glow cyan) y de Sistema (paths). */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute top-1/2 right-[6%] size-[44rem] max-w-[90vw] -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(231,200,160,0.10),rgba(168,140,100,0.05)_42%,transparent_70%)] blur-3xl" />
      </div>

      <div className="mx-auto w-full max-w-6xl px-6 lg:max-w-7xl lg:px-8">
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
