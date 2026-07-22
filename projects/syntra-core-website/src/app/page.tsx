import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { JsonLd } from "@/components/shared/json-ld";
import { HeroSection } from "@/components/sections/hero-section";
import { ServicesSection } from "@/components/sections/services-section";
import { UseCasesSection } from "@/components/sections/use-cases-section";
import { AboutSection } from "@/components/sections/about-section";
import { WorkflowSection } from "@/components/sections/workflow-section";
import { FaqSection } from "@/components/sections/faq-section";
import { FinalCtaSection } from "@/components/sections/final-cta-section";

/**
 * Home — landing oficial SYNTRA CORE.
 * Flujo: Hero → Servicios → Casos → Proceso → Nosotros → FAQ → CTA.
 * Secciones conectadas directo, sin frases-bisagra (el owner eliminó el último
 * SectionBridge el 2026-07-09). Nosotros va después de Proceso (confianza antes
 * del cierre), sin tocar su contenido interno.
 */
export default function Home() {
  return (
    <>
      <JsonLd />
      <Navbar />

      <main id="contenido" tabIndex={-1} className="flex flex-1 flex-col">
        <HeroSection />
        <ServicesSection />
        <UseCasesSection />
        <WorkflowSection />
        <AboutSection />
        <FaqSection />
        <FinalCtaSection />
      </main>

      <Footer />
    </>
  );
}
