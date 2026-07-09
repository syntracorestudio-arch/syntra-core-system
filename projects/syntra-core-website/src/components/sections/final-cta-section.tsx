import Link from "next/link";

import { siteConfig } from "@/config/site";
import { getIcon } from "@/lib/icons";
import { Section } from "@/components/layout/section";
import { Container } from "@/components/layout/container";
import { ContactoBackdrop } from "@/components/marketing/aplicaciones/contacto-backdrop";
import { ContactoCore } from "@/components/marketing/aplicaciones/contacto-core";
import { BlurReveal } from "@/components/animations/blur-reveal";
import { TrackedLink } from "@/components/shared/tracked-link";
import { ContactForm } from "@/components/sections/contact-form";

/**
 * FinalCtaSection — cierre de la landing y captación de leads (#contacto).
 * Formulario real (Server Action + Zod + Supabase). Sin lógica en el cliente
 * más allá de la UX del form. Content-driven.
 *
 * Fondo vivo "El campo se inclina hacia vos" (reference-lock contacto.md): el campo
 * interactivo vive a nivel SECCIÓN, por FUERA de la card; la card (opaca) aísla el
 * formulario y el campo respira en el espacio negativo alrededor (arriba/abajo/costados).
 * El rail izquierdo lleva el cierre narrativo + la confianza; el form —más ancho— es
 * protagonista.
 */
function FinalCtaSection() {
  const { finalCta } = siteConfig.sections;

  return (
    <Section id="contacto" contained={false} className="relative pb-14 sm:pb-20 lg:pb-16">
      {/* Fondo vivo interactivo a nivel SECCIÓN: por fuera de la card, respira alrededor */}
      <ContactoBackdrop />

      <Container className="relative z-10">
        <BlurReveal>
          <div className="relative overflow-hidden rounded-3xl border border-border bg-depth-sunken px-6 py-12 sm:px-10 sm:py-14">
            {/* Hairline de acento superior (estructural, como el panel de Casos) */}
            <span
              aria-hidden="true"
              className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent-primary/60 to-transparent"
            />

            <div className="relative z-10 grid items-start gap-10 lg:grid-cols-[minmax(0,28rem)_minmax(0,1fr)] lg:gap-14">
              {/* Rail izquierdo: cierre narrativo + capacidades + núcleo SC + confianza.
                  self-stretch + justify-between: el cierre va arriba, el núcleo SC ancla
                  el centro y la confianza baja al PIE (resuelve el espacio muerto con
                  contenido/marca, no con relleno). */}
              <div className="flex flex-col items-center gap-8 text-center lg:items-stretch lg:self-stretch lg:justify-between lg:text-left">
                {/* Grupo arriba: cierre narrativo + capacidades */}
                <div className="flex flex-col gap-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-accent-primary">
                    {finalCta.eyebrow}
                  </p>
                  <h2 className="font-heading text-3xl font-bold tracking-tight text-balance sm:text-4xl">
                    {finalCta.title}
                  </h2>
                  <p className="text-base leading-relaxed text-muted-foreground text-pretty sm:text-lg">
                    {finalCta.subtitle}
                  </p>

                  {/* Capacidades: íconos line tenues + label (content-driven) */}
                  <ul className="mt-2 flex flex-col gap-3 text-left">
                    {finalCta.capabilities.map((cap) => {
                      const Icon = getIcon(cap.icon);
                      return (
                        <li
                          key={cap.label}
                          className="flex items-center justify-center gap-3 lg:justify-start"
                        >
                          <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-border-strong/50 bg-surface-1/50 text-accent-primary">
                            <Icon
                              aria-hidden="true"
                              strokeWidth={1.75}
                              className="size-[18px]"
                            />
                          </span>
                          <span className="text-sm font-medium text-foreground/85">
                            {cap.label}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                {/* Núcleo SC: pieza-firma del rail (CSS/SVG, subordinada al CTA).
                    Oculto en mobile chico si aprieta el ritmo del stack. */}
                <div className="hidden justify-center sm:flex lg:justify-start">
                  <ContactoCore />
                </div>

                {/* Grupo abajo: confianza (email + privacidad) anclado al pie */}
                <div className="flex flex-col gap-4">
                  <p className="text-sm text-muted-foreground">
                    También podés escribirnos a{" "}
                    <TrackedLink
                      href={`mailto:${siteConfig.email}`}
                      className="text-[#60a5fa] underline-offset-4 hover:underline"
                      trackProps={{ location: "final_cta", target: "mailto" }}
                    >
                      {siteConfig.email}
                    </TrackedLink>
                  </p>
                  {/* Confianza + privacidad (sin prometer tiempos) — equilibra el rail */}
                  <p className="mt-1 border-t border-border/60 pt-5 text-xs leading-relaxed text-muted-foreground">
                    Usamos tus datos solo para responder esta consulta. Podés ver
                    cómo los tratamos en nuestra{" "}
                    <Link
                      href="/privacidad"
                      className="text-[#60a5fa] underline-offset-4 hover:underline"
                    >
                      Política de privacidad
                    </Link>
                    .
                  </p>
                </div>
              </div>

              {/* Formulario (protagonista) — centrado vertical en lg para aprovechar
                  el alto del rail (el rail es más alto por el núcleo + capacidades). */}
              <div className="lg:self-center">
                <ContactForm />
              </div>
            </div>
          </div>
        </BlurReveal>
      </Container>
    </Section>
  );
}

export { FinalCtaSection };
