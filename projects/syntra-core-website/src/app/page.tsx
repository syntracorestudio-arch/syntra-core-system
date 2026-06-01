import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { JsonLd } from "@/components/shared/json-ld";
import { HeroSection } from "@/components/sections/hero-section";
import { ServicesSection } from "@/components/sections/services-section";
import { UseCasesSection } from "@/components/sections/use-cases-section";
import { WhyChooseSection } from "@/components/sections/why-choose-section";
import { AboutSection } from "@/components/sections/about-section";
import { WorkflowSection } from "@/components/sections/workflow-section";
import { FaqSection } from "@/components/sections/faq-section";
import { FinalCtaSection } from "@/components/sections/final-cta-section";

/**
 * Home — landing oficial SYNTRA CORE.
 * Flujo: Hero → Servicios → Casos → Por qué SYNTRA → Nosotros → Proceso → FAQ → CTA.
 */
export default function Home() {
  return (
    <>
      <JsonLd />
      <Navbar />

      <main className="flex flex-1 flex-col">
        <HeroSection />
        <ServicesSection />
        <UseCasesSection />
        <WhyChooseSection />
        <AboutSection />
        <WorkflowSection />
        <FaqSection />
        <FinalCtaSection />
      </main>

      <Footer />
    </>
  );
}
