import Image from "next/image";
import Link from "next/link";

import { footerBrand, services, siteConfig } from "@/config/site";
import { Container } from "@/components/layout/container";
import { BlurReveal } from "@/components/animations/blur-reveal";
import { FooterSocial } from "@/components/layout/footer-social";

/**
 * Footer — cierre de marca v3 (iteración owner 2026-07-07: redes a color de
 * marca, sin crédito dogfooding, privacidad en la barra final, cascada de
 * entrada por columna).
 *
 * Near-black CONTINUO desde el campo de Contacto (sin border-t) apagándose en
 * gradiente. 4 columnas de contenido real: Marca (logo grande + frase +
 * redes a color) · Secciones · Servicios · Contacto. Barra final:
 * © + Política de privacidad. Glow electric respirando al pie.
 * Server Component (BlurReveal aporta la cascada client-side).
 */

/** Clase compartida de los links de columna (hover con precisión premium). */
const columnLink =
  "inline-block text-sm text-smoke-2 underline-offset-4 transition-[color,transform] duration-200 hover:translate-x-0.5 hover:text-foreground hover:underline hover:decoration-brand-electric/60";

function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative overflow-hidden bg-gradient-to-b from-[#06070d] via-[#05060b] to-[#04050a]">
      {/* Glow de cierre respirando al pie (la energía del sistema en reposo) */}
      <div
        aria-hidden="true"
        className="animate-breathe pointer-events-none absolute inset-x-0 bottom-[-30%] h-[60%] bg-[radial-gradient(55%_80%_at_50%_100%,rgba(37,99,235,0.10),transparent_72%)] blur-2xl"
      />

      <Container className="relative pb-8 pt-14 sm:pt-16">
        {/* === Grid de contenido: marca + 3 columnas (cascada de entrada) === */}
        <div className="grid gap-10 text-center sm:grid-cols-2 sm:text-left lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] lg:gap-8">
          {/* Col 1 — Marca */}
          <BlurReveal className="flex flex-col items-center gap-4 sm:col-span-2 sm:items-start lg:col-span-1">
            <Image
              src="/logo.png"
              alt="SYNTRA CORE"
              width={800}
              height={378}
              sizes="140px"
              className="h-14 w-auto sm:h-16"
            />
            <p className="max-w-xs text-sm leading-relaxed text-smoke-2 text-pretty">
              {footerBrand}
            </p>
            <FooterSocial />
          </BlurReveal>

          {/* Col 2 — Secciones */}
          <BlurReveal delay={0.1}>
            <nav aria-label="Secciones del sitio">
              <p className="font-accent text-[0.7rem] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                Secciones
              </p>
              <ul className="mt-4 flex flex-col gap-2.5">
                {siteConfig.nav.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className={columnLink}>
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </BlurReveal>

          {/* Col 3 — Servicios (los módulos reales) */}
          <BlurReveal delay={0.18}>
            <nav aria-label="Servicios">
              <p className="font-accent text-[0.7rem] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                Servicios
              </p>
              <ul className="mt-4 flex flex-col gap-2.5">
                {services.map((service) => (
                  <li key={service.id}>
                    <Link href="/#servicios" className={columnLink}>
                      {service.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </BlurReveal>

          {/* Col 4 — Contacto */}
          <BlurReveal delay={0.26}>
            <p className="font-accent text-[0.7rem] font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Contacto
            </p>
            <ul className="mt-4 flex flex-col gap-2.5 text-sm">
              <li>
                <Link href="/#contacto" className={columnLink}>
                  Contanos tu proyecto
                </Link>
              </li>
              <li>
                <a
                  href={`mailto:${siteConfig.email}`}
                  className="text-[#60a5fa] underline-offset-4 transition-colors hover:underline"
                >
                  {siteConfig.email}
                </a>
              </li>
            </ul>
          </BlurReveal>
        </div>

        {/* === Barra final: copyright · privacidad === */}
        <BlurReveal delay={0.34}>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-border/40 pt-5 text-xs text-muted-foreground sm:justify-between">
            <p>
              © {year} {siteConfig.name} — Todos los derechos reservados
            </p>
            <Link
              href="/privacidad"
              className="transition-colors hover:text-foreground"
            >
              Política de privacidad
            </Link>
          </div>
        </BlurReveal>
      </Container>
    </footer>
  );
}

export { Footer };
