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

            {/* Columna de IMAGEN protagonista a 33rem (calibrado owner) — se
                mantiene desde xl, que es el ancho donde se calibró. Entre 1024
                y 1279 esos 33rem fijos dejaban al FORM en 350px: los campos
                Nombre/Email caían a 165px y los 5 chips se apilaban en 5 filas
                (medido, auditoría responsive 2026-07-22). En esa banda el
                reparto pasa a ser mitad y mitad. El asset es un LIENZO vertical
                compuesto → cover casi sin recorte en cualquiera de los dos. */}
            <div className="relative z-10 grid lg:grid-cols-2 xl:grid-cols-[minmax(0,33rem)_minmax(0,1fr)]">
              {/* ===== Panel izquierdo IMAGE-LED: la imagen de marca es el fondo de
                  TODA la mitad (full-bleed hasta los bordes de la card); el cierre
                  narrativo + confianza componen encima, distribuidos a alto completo
                  (justify-between → sin espacio muerto). ===== */}
              <div className="relative overflow-hidden">
                {/* BASE: la imagen aprobada, SIEMPRE visible (composición y
                    luminancia fijas → AA calculable de una vez). */}
                <Image
                  src="/visual-assets/syntra/contacto/panel-vidrio.webp"
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 33rem, 100vw"
                  quality={90}
                  className="object-cover object-center"
                />

                {/* VIDA PUNTUAL (desktop + motion; lazy): brasas ascendiendo +
                    respiración dorada SOBRE la imagen — dirección B aprobada
                    2026-07-14 (muerte de las columnas 3D: alta frecuencia +
                    brillo mutante = el texto se perdía por construcción). */}
                <PanelVida />

                {/* Scrims: columna de texto en CALMA (izq→der; H2/capacidades
                    viven a la izquierda) + base abajo→arriba + costura suave
                    hacia el lado del form (borde derecho, solo lg) */}
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-gradient-to-r from-[#0b1120]/60 via-[#0b1120]/20 to-transparent"
                />
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-gradient-to-t from-[#0b1120]/80 via-[#0b1120]/28 to-[#0b1120]/15"
                />
                <div
                  aria-hidden="true"
                  className="absolute inset-y-0 right-0 hidden w-20 bg-gradient-to-l from-[#0b1120] to-transparent lg:block"
                />

                <div className="relative z-10 flex h-full flex-col gap-10 px-6 py-12 text-center sm:px-10 sm:py-14 lg:justify-between lg:text-left">
                  {/* Grupo arriba COMPACTO: narrativa + capacidades juntas (sin
                      espacio muerto); el tramo inferior del panel queda para la
                      ESCENA del asset (el visual llena, no el texto). */}
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

                  {/* "Qué recibís" (PED): la única pregunta abierta a esta altura.
                      Reemplaza a las capacidades, que duplicaban los chips del form. */}
                  <p className="mt-6 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[#e7c8a0]/85">
                    {finalCta.deliverablesHeading}
                  </p>
                  <ul className="mt-3 flex flex-col gap-3 text-left">
                    {finalCta.deliverables.map((item) => {
                      const Icon = getIcon(item.icon);
                      return (
                        <li
                          key={item.icon}
                          className="flex items-start justify-center gap-3 lg:justify-start"
                        >
                          <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg border border-white/15 bg-[#0b1120]/60 text-[#8ab6ff] backdrop-blur-sm">
                            <Icon
                              aria-hidden="true"
                              strokeWidth={1.75}
                              className="size-4"
                            />
                          </span>
                          <span className="text-sm leading-snug text-foreground/90">
                            {item.label}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  </div>

                  {/* Grupo abajo: mailto con encuadre + privacidad al pie */}
                  <div className="flex flex-col gap-4">
                    <p className="text-sm text-foreground/75">
                      <span className="mr-1.5 font-medium text-foreground/90">
                        {finalCta.mailtoLead}
                      </span>
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
