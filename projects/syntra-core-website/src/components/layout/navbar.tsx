"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { Menu, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";
import { siteConfig } from "@/config/site";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/layout/container";

/**
 * Navbar — sticky, minimalista, con blur que aparece al hacer scroll.
 * Client island (interacción de scroll + menú mobile). Ref: ui-direction.md.
 */
function Navbar() {
  const [scrolled, setScrolled] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 64);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-300",
        scrolled
          ? "border-b border-border bg-depth-sunken/90 backdrop-blur-md"
          : "border-b border-transparent",
      )}
    >
      {!scrolled && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-20 bg-gradient-to-b from-background/70 to-transparent"
        />
      )}

      <Container className="flex h-16 items-center justify-between">
        <Link href="/" aria-label="SYNTRA CORE — Inicio">
          <Image
            src="/logo.png"
            alt="SYNTRA CORE"
            width={800}
            height={378}
            priority
            sizes="200px"
            className="h-10 w-auto"
          />
        </Link>

        {/* Navegación desktop */}
        <nav
          aria-label="Navegación principal"
          className="hidden items-center gap-8 md:flex"
        >
          {siteConfig.nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:block">
          <Button asChild variant="brand" size="lg">
            <Link
              href="/#contacto"
              onClick={() => track("cta_click", { location: "navbar" })}
            >
              {siteConfig.cta.primary}
            </Link>
          </Button>
        </div>

        {/* Toggle mobile */}
        <button
          type="button"
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex size-9 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-secondary md:hidden"
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </Container>

      {/* Menú mobile */}
      {open && (
        <nav
          id="mobile-menu"
          aria-label="Navegación móvil"
          className="border-t border-border bg-depth-sunken md:hidden"
        >
          <Container className="flex flex-col gap-1 py-4">
            {siteConfig.nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
            <Button asChild variant="brand" size="lg" className="mt-2 w-full">
              <Link
                href="/#contacto"
                onClick={() => {
                  track("cta_click", { location: "navbar-mobile" });
                  setOpen(false);
                }}
              >
                {siteConfig.cta.primary}
              </Link>
            </Button>
          </Container>
        </nav>
      )}
    </header>
  );
}

export { Navbar };
