import { siteConfig } from "@/config/site";
import { Section } from "@/components/layout/section";
import { SectionHeading } from "@/components/shared/section-heading";
import { BlurReveal } from "@/components/animations/blur-reveal";
import { CasosBackdrop } from "@/components/marketing/aplicaciones/casos-backdrop";
import { ServiceDemoSelector } from "@/components/marketing/aplicaciones/demos/service-demo-selector";

/**
 * UseCasesSection — "Ejemplos / Lo que construimos, funcionando" (Casos v2,
 * 2026-07-07). Reemplaza el eje por-rubro por 4 DEMOS VIVAS del servicio en
 * orden pipeline (landing → asistente → automatización → panel); la misma
 * consulta ficticia (Julián P.) atraviesa las piezas. Fondo vivo "Campo de
 * señales" (<CasosBackdrop>) conservado intacto. Server Component: el
 * selector y las demos son client.
 */
function UseCasesSection() {
  const { eyebrow, title, subtitle } = siteConfig.sections.useCases;

  return (
    <Section id="casos" contained={false} className="relative overflow-hidden">
      <CasosBackdrop />

      <div className="relative z-10 mx-auto w-full max-w-6xl px-6 lg:max-w-7xl lg:px-8">
        <BlurReveal>
          <SectionHeading
            eyebrow={eyebrow}
            title={title}
            subtitle={subtitle}
            align="left"
            className="max-w-2xl"
          />
        </BlurReveal>

        <ServiceDemoSelector />
      </div>
    </Section>
  );
}

export { UseCasesSection };
