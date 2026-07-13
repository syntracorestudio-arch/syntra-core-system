import Image from "next/image";
import Link from "next/link";

import { siteConfig } from "@/config/site";
import { getIcon } from "@/lib/icons";
import { Section } from "@/components/layout/section";
import { Container } from "@/components/layout/container";
import { PanelVida } from "@/components/marketing/aplicaciones/panel-vida";
import { SectionAtmosphere } from "@/components/marketing/living/section-atmosphere";
import { BlurReveal } from "@/components/animations/blur-reveal";
import { TrackedLink } from "@/components/shared/tracked-link";
import { ContactForm } from "@/components/sections/contact-form";

/**
 * FinalCtaSection — cierre de la landing y captación de leads (#contacto).
 * Formulario real (Server Action + Zod + Supabase). Sin lógica en el cliente
 * más allá de la UX del form. Content-driven.
 *
 * Layout "panel image-led" (idea del owner, 2026-07-13): la MITAD IZQUIERDA de la
 * card es una IMAGEN de marca full-bleed (estratos de vidrio creciendo, electric→
 * warm — bookend con el Hero) con el cierre narrativo compuesto ENCIMA (scrim de
 * legibilidad AA); la mitad derecha es el form intacto. Muerte del "objeto chico
 * flotando" en el rail: el artefacto visual ahora es el panel entero (lección
 * Servicios v5). Asset: panel-vidrio.webp (render curado, asset-first).
 */
function FinalCtaSection() {
  const { finalCta } = siteConfig.sections;

  return (
    <Section id="contacto" contained={false} className="relative pb-14 sm:pb-20 lg:pb-16">
      {/* Fondo unificado del sitio (pedido owner 2026-07-13): la MISMA atmósfera que
          Servicios/Ejemplos/Proceso/FAQ — base #05070c + auroras térmicas + campo
          estelar (3D en desktop, dots CSS en mobile/reduced). Reemplaza al campo
          interactivo propio de Contacto (se veía desalineado del resto). */}
      <SectionAtmosphere accent="dual" />

      <Container className="relative z-10">
        <BlurReveal>
          <div className="relative overflow-hidden rounded-3xl border border-border bg-depth-sunken">
            {/* Hairline TÉRMICO superior: electric→warm — continúa el puente de FAQ
                (el aterrizaje del sitio cierra con la misma respiración dual). */}
            <span
              aria-hidden="true"
              className="absolute inset-x-0 top-0 z-20 h-px"
              style={{
                background:
                  "linear-gradient(90deg, transparent, rgba(96,165,250,0.55) 38%, rgba(231,200,160,0.5) 62%, transparent)",
              }}
            />
            {/* Atmósfera interna (lado del form): aurora warm + grano — decorativo. */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-0">
              <div className="absolute -right-24 -bottom-32 size-[26rem] rounded-full bg-[radial-gradient(circle,rgba(231,200,160,0.07),transparent_65%)] blur-2xl" />
              <div
                className="absolute inset-0 opacity-[0.35]"
                style={{
                  backgroundImage:
                    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")",
                }}
              />
            </div>

            <div className="relative z-10 grid lg:grid-cols-[minmax(0,31rem)_minmax(0,1fr)]">
              {/* ===== Panel izquierdo IMAGE-LED: la imagen de marca es el fondo de
                  TODA la mitad (full-bleed hasta los bordes de la card); el cierre
                  narrativo + confianza componen encima, distribuidos a alto completo
                  (justify-between → sin espacio muerto). ===== */}
              <div className="relative overflow-hidden">
                {/* Poster estático: SSR + mobile + reduced-motion. En desktop con
                    motion, PanelVida lo cubre con la escena 3D viva. */}
                <Image
                  src="/visual-assets/syntra/contacto/panel-vidrio.webp"
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 27rem, 100vw"
                  className="object-cover object-[62%_center]"
                />

                {/* FONDO 3D VIVO (desktop + motion; lazy): columnas de vidrio con
                    luz recorriéndolas + brasas ascendiendo — recrea el poster en
                    tiempo real. Va ANTES de los scrims: ellos garantizan la
                    legibilidad del texto también sobre la escena animada. */}
                <PanelVida />

                {/* Scrims: legibilidad AA (abajo→arriba) + costura suave hacia el
                    lado del form (borde derecho, solo lg) */}
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-gradient-to-t from-[#0b1120]/92 via-[#0b1120]/55 to-[#0b1120]/25"
                />
                <div
                  aria-hidden="true"
                  className="absolute inset-y-0 right-0 hidden w-20 bg-gradient-to-l from-[#0b1120] to-transparent lg:block"
                />

                <div className="relative z-10 flex h-full flex-col gap-10 px-6 py-12 text-center sm:px-10 sm:py-14 lg:justify-between lg:text-left">
                  {/* Grupo arriba: cierre narrativo + capacidades */}
                  <div className="flex flex-col gap-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#8ab6ff]">
                      {finalCta.eyebrow}
                    </p>
                    <h2 className="font-heading text-3xl font-bold tracking-tight text-balance sm:text-4xl">
                      {finalCta.title}
                    </h2>
                    <p className="text-base leading-relaxed text-foreground/80 text-pretty sm:text-lg">
                      {finalCta.subtitle}
                    </p>
                  </div>

                  {/* Capacidades: ancladas al centro-bajo del panel, sobre la zona
                      más oscura del scrim */}
                  <ul className="flex flex-col gap-3 text-left">
                    {finalCta.capabilities.map((cap) => {
                      const Icon = getIcon(cap.icon);
                      return (
                        <li
                          key={cap.label}
                          className="flex items-center justify-center gap-3 lg:justify-start"
                        >
                          <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-white/15 bg-[#0b1120]/60 text-[#8ab6ff] backdrop-blur-sm">
                            <Icon
                              aria-hidden="true"
                              strokeWidth={1.75}
                              className="size-[18px]"
                            />
                          </span>
                          <span className="text-sm font-medium text-foreground/90">
                            {cap.label}
                          </span>
                        </li>
                      );
                    })}
                  </ul>

                  {/* Grupo abajo: confianza (email + privacidad) al pie del panel */}
                  <div className="flex flex-col gap-4">
                    <p className="text-sm text-foreground/75">
                      También podés escribirnos a{" "}
                      <TrackedLink
                        href={`mailto:${siteConfig.email}`}
                        className="text-[#8ab6ff] underline-offset-4 hover:underline"
                        trackProps={{ location: "final_cta", target: "mailto" }}
                      >
                        {siteConfig.email}
                      </TrackedLink>
                    </p>
                    <p className="mt-1 border-t border-white/15 pt-5 text-xs leading-relaxed text-foreground/60">
                      Usamos tus datos solo para responder esta consulta. Podés ver
                      cómo los tratamos en nuestra{" "}
                      <Link
                        href="/privacidad"
                        className="text-[#8ab6ff] underline-offset-4 hover:underline"
                      >
                        Política de privacidad
                      </Link>
                      .
                    </p>
                  </div>
                </div>
              </div>

              {/* ===== Mitad derecha: el form, intacto ===== */}
              <div className="px-6 py-12 sm:px-10 sm:py-14 lg:self-center">
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
