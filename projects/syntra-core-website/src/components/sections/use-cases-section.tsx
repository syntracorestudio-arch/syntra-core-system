import { siteConfig } from "@/config/site";
import { Section } from "@/components/layout/section";
import { Container } from "@/components/layout/container";
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

      {/* Casos usaba su propia grilla ancha (max-w-7xl) y quedaba como único
          borde huérfano del recorrido: a 1920 arrancaba en 352px contra los
          416px del resto de las secciones — 64px, demasiado poco para leerse
          como decisión y suficiente para leerse como error. Al pasar al
          Container el artefacto NO se achica: la demo tiene tope propio de
          480px y la pista sobra (593px medidos); lo único que cede son 55px
          del rail editorial. Medido, auditoría responsive 2026-07-22. */}
      <Container className="relative z-10">
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
      </Container>
    </Section>
  );
}

export { UseCasesSection };
