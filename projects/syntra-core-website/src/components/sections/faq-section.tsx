import { ChevronDown } from "lucide-react";

import { faqs, siteConfig } from "@/config/site";
import { Section } from "@/components/layout/section";
import { SectionHeading } from "@/components/shared/section-heading";
import { BlurReveal } from "@/components/animations/blur-reveal";

/**
 * FaqSection — preguntas frecuentes (manejo de objeciones).
 * Acordeón nativo con <details>/<summary>: accesible y sin JS de cliente.
 * Server Component.
 */
function FaqSection() {
  const { eyebrow, title, subtitle } = siteConfig.sections.faq;

  return (
    <Section id="faq" className="bg-depth-raised">
      <BlurReveal>
        <SectionHeading eyebrow={eyebrow} title={title} subtitle={subtitle} />
      </BlurReveal>

      <div className="mx-auto mt-12 flex w-full max-w-3xl flex-col gap-3">
        {faqs.map((faq) => (
          <details
            key={faq.question}
            className="group rounded-2xl border border-border bg-surface-1 px-5 transition-colors open:border-accent-primary/40"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-medium text-foreground [&::-webkit-details-marker]:hidden">
              {faq.question}
              <ChevronDown
                className="size-5 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180"
                aria-hidden="true"
              />
            </summary>
            <p className="pb-4 leading-relaxed text-muted-foreground">
              {faq.answer}
            </p>
          </details>
        ))}
      </div>
    </Section>
  );
}

export { FaqSection };
