import { siteConfig } from "@/config/site";
import { Section } from "@/components/layout/section";
import { GlowOrb } from "@/components/shared/glow-orb";
import { BlurReveal } from "@/components/animations/blur-reveal";
import { ContactForm } from "@/components/sections/contact-form";

/**
 * FinalCtaSection — cierre de la landing y captación de leads (#contacto).
 * Formulario real (Server Action + Zod + Supabase). Sin lógica en el cliente
 * más allá de la UX del form. Content-driven.
 */
function FinalCtaSection() {
  const { finalCta } = siteConfig.sections;

  return (
    <Section id="contacto">
      <BlurReveal>
        <div className="surface-glass relative overflow-hidden rounded-3xl border border-border px-6 py-14 sm:px-12 sm:py-16">
          <GlowOrb
            tone="electric"
            size="lg"
            className="-top-24 left-1/2 -translate-x-1/2"
          />

          <div className="relative mx-auto grid max-w-5xl items-center gap-12 lg:grid-cols-2">
            {/* Copy */}
            <div className="flex flex-col gap-5 text-center lg:text-left">
              <h2 className="font-heading text-3xl font-bold tracking-tight text-balance sm:text-4xl">
                {finalCta.title}
              </h2>
              <p className="text-base leading-relaxed text-muted-foreground text-pretty sm:text-lg">
                {finalCta.subtitle}
              </p>
              <p className="text-sm text-muted-foreground">
                O escribinos directo a{" "}
                <a
                  href={`mailto:${siteConfig.email}`}
                  className="text-brand-cyan underline-offset-4 hover:underline"
                >
                  {siteConfig.email}
                </a>
              </p>
            </div>

            {/* Formulario */}
            <ContactForm />
          </div>
        </div>
      </BlurReveal>
    </Section>
  );
}

export { FinalCtaSection };
