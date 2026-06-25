import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { JsonLd } from "@/components/shared/json-ld";
import { SectionBridge } from "@/components/shared/section-bridge";
import { homeBridges } from "@/config/site";
import { HeroSection } from "@/components/sections/hero-section";
import { ServicesSection } from "@/components/sections/services-section";
import { UseCasesSection } from "@/components/sections/use-cases-section";
import { AboutSection } from "@/components/sections/about-section";
import { WorkflowSection } from "@/components/sections/workflow-section";
import { SolutionArchitectureSection } from "@/components/sections/solution-architecture-section";
import { FaqSection } from "@/components/sections/faq-section";
import { FinalCtaSection } from "@/components/sections/final-cta-section";

/**
 * Home — landing oficial SYNTRA CORE.
 * Flujo: Hero → Servicios → Casos → Proceso → Sistema → Nosotros → FAQ → CTA.
 * Las frases-bisagra (SectionBridge) cosen el relato sección a sección (WEB-012B):
 * el resultado de cada bloque es el input del siguiente. Nosotros se reubicó
 * después de Sistema (confianza antes del cierre), sin tocar su contenido interno.
 */
export default function Home() {
  return (
    <>
      <JsonLd />
      <Navbar />

      <main className="flex flex-1 flex-col">
        <HeroSection />
        <ServicesSection />
        <SectionBridge>{homeBridges.servicesToUseCases}</SectionBridge>
        <UseCasesSection />
        {/* Sin SectionBridge entre Casos y Proceso: el campo de señales converge al nodo
            y entra directo al cable de Proceso (continuidad visual resultado→método). */}
        <WorkflowSection />
        <SectionBridge>{homeBridges.workflowToSolution}</SectionBridge>
        <SolutionArchitectureSection />
        <AboutSection />
        <FaqSection />
        <FinalCtaSection />
      </main>

      <Footer />
    </>
  );
}
