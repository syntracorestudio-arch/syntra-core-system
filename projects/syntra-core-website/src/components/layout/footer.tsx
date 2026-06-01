import Image from "next/image";
import Link from "next/link";

import { siteConfig } from "@/config/site";
import { Container } from "@/components/layout/container";

/**
 * Footer — minimalista, en español. Server Component.
 */
function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border">
      <Container className="flex flex-col items-center justify-between gap-6 py-10 sm:flex-row">
        <div className="flex flex-col items-center gap-2">
          <Image
            src="/logo.png"
            alt="SYNTRA CORE"
            width={800}
            height={378}
            sizes="240px"
            className="h-11 w-auto"
          />
          <p className="text-xs text-muted-foreground">
            Software Factory AI-Native
          </p>
        </div>

        <nav aria-label="Enlaces del pie" className="flex flex-wrap justify-center gap-x-6 gap-y-2">
          {siteConfig.nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/privacidad"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Privacidad
          </Link>
        </nav>

        <p className="text-xs text-muted-foreground">
          © {year} {siteConfig.name}
        </p>
      </Container>
    </footer>
  );
}

export { Footer };
