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

/** Clase compartida de los links de columna (hover con precisión premium).
 *  py-1.5/-my-1.5: el alto de toque pasa de 20px a 44px SIN mover el ritmo
 *  visual de la lista (el padding se cancela con el margen negativo). */
const columnLink =
  "inline-block -my-1.5 py-1.5 text-sm text-smoke-2 underline-offset-4 transition-[color,transform] duration-200 hover:translate-x-0.5 hover:text-foreground hover:underline hover:decoration-brand-electric/60";

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
        {/* lg: pistas de ancho FIJO + justify-between → espacios entre columnas
            iguales, y la barra final (misma plantilla) alinea EXACTO con ellas.
            (Subgrid descartado: Chromium no hereda la distribución del
            justify-content del padre.) */}
        {/* sm:grid-cols-3 (era 2): con dos pistas las tres navs quedaban en 2+1
            y Contacto caía sola en una tercera fila, con el hueco al lado. Las
            tres columnas son cortas y entran de sobra a 640px. */}
        <div className="grid gap-10 text-center sm:grid-cols-3 sm:text-left lg:grid-cols-[minmax(0,24rem)_7rem_9.5rem_9.5rem] lg:justify-between lg:gap-8">
          {/* Col 1 — Marca: bloque CENTRADO (logo + tagline + social alineados
              al mismo eje, pedido owner 2026-07-14) */}
          <BlurReveal className="flex flex-col items-center gap-4 text-center sm:col-span-3 lg:col-span-1">
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

        {/* === Barra final: MISMA plantilla de pistas que las columnas → el ©
            queda centrado bajo la marca y Política arranca exacto en la pista
            de CONTACTO (pedido owner 2026-07-14). === */}
        <BlurReveal
          delay={0.34}
          className="mt-10 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-border/40 pt-5 text-xs text-muted-foreground sm:justify-between lg:grid lg:grid-cols-[minmax(0,24rem)_7rem_9.5rem_9.5rem] lg:justify-between lg:gap-x-8"
        >
          <p className="lg:col-start-1 lg:text-center">
            © {year} {siteConfig.name} — Todos los derechos reservados
          </p>
          <Link
            href="/privacidad"
            // -my-2/py-2: 32px de toque (medía 16px, por debajo del mínimo AA
            // de 24px) sin alterar la barra final.
            className="-my-2 py-2 transition-colors hover:text-foreground lg:col-start-4 lg:justify-self-start"
          >
            Política de privacidad
          </Link>
        </BlurReveal>
      </Container>
    </footer>
  );
}

export { Footer };
