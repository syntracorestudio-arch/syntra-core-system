import Image from "next/image";
import Link from "next/link";

import { footerBrand, siteConfig } from "@/config/site";
import { Container } from "@/components/layout/container";

/**
 * Footer — firma de marca + índice al pie (TASK-015B2 refinement).
 * Hairline de acento + fondo recesado (depth-sunken, "pie"). A la izquierda, la
 * firma de marca protagonista (logo · frase · email); a la derecha, el índice de
 * navegación en una fila con separadores hairline reales. Barra inferior fina con
 * legal · copyright. Compacto, sobrio, sin mini-CTA: cierra la experiencia, no
 * compite con Contacto. Server Component.
 */
function Footer() {
  const year = new Date().getFullYear();
  const socialLinks = siteConfig.socialLinks ?? [];

  return (
    <footer className="relative border-t border-border bg-depth-sunken">
      {/* Hairline de acento superior */}
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-electric/50 to-transparent"
      />

      <Container className="py-7">
        {/* === Marca/contacto · navegación === */}
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          {/* Marca + frase + email */}
          <div className="flex max-w-sm flex-col items-center gap-3 text-center md:items-start md:text-left">
            <Image
              src="/logo.png"
              alt="SYNTRA CORE"
              width={800}
              height={378}
              sizes="200px"
              className="h-9 w-auto"
            />
            <p className="text-sm font-normal leading-relaxed text-foreground text-pretty">
              {footerBrand}
            </p>
            <a
              href={`mailto:${siteConfig.email}`}
              className="text-sm text-brand-cyan underline-offset-4 transition-colors hover:underline"
            >
              {siteConfig.email}
            </a>

            {/* Canales sociales — no renderiza nada si la lista está vacía */}
            {socialLinks.length > 0 && (
              <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 md:justify-start">
                {socialLinks.map((social) => (
                  <li key={social.href}>
                    <a
                      href={social.href}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {social.label}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Navegación — índice inline con separadores hairline reales */}
          <nav aria-label="Navegación del pie">
            <ul className="flex flex-col items-center gap-y-2 text-center sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-4 sm:gap-y-1 md:justify-end">
              {siteConfig.nav.map((item, index) => (
                <li key={item.href} className="flex items-center gap-x-4">
                  {index > 0 && (
                    <span
                      aria-hidden="true"
                      className="hidden h-3 w-px bg-border sm:inline-block"
                    />
                  )}
                  <Link
                    href={item.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        {/* === Barra inferior: legal · copyright === */}
        <div className="mt-6 flex items-center justify-center gap-3 border-t border-border pt-5 text-xs text-muted-foreground">
          <Link
            href="/privacidad"
            className="transition-colors hover:text-foreground"
          >
            Privacidad
          </Link>
          <span aria-hidden="true" className="h-3 w-px bg-border" />
          <p>
            © {year} {siteConfig.name}
          </p>
        </div>
      </Container>
    </footer>
  );
}

export { Footer };
