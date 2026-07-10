"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";
import { siteConfig } from "@/config/site";
import { Button } from "@/components/ui/button";

/**
 * Navbar — sticky premium. Top transparente con gradiente; glass al scrollear.
 * Header polish (P0+P1 + correcciones): grilla alineada al Hero (sin tocar
 * Container global), logo con más presencia, cluster nav+CTA a la derecha
 * (composición compacta, no estirada), nav con hover underline + active section
 * (guard: ninguno activo en el Hero/top) + focus-visible, CTA compacto, glass
 * on-scroll refinado, y click en el logo → vuelve al top en la home.
 */

/** Ancho/padding ALINEADOS al contenedor de contenido del Hero. */
const SHELL =
  "mx-auto w-full max-w-6xl px-6 lg:max-w-7xl lg:px-8 2xl:max-w-[94rem] 2xl:px-12";

/** Debajo de este % del viewport (estás en el Hero/top) → ninguna sección activa. */
const TOP_GUARD = 0.6;

function navId(href: string): string {
  return href.split("#")[1] ?? "";
}

function Navbar() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState("");
  // Progreso de scroll 0→1 para el hairline del Header (Sprint 01).
  const [progress, setProgress] = React.useState(0);

  React.useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 64);
      // Progreso de lectura (0 en el top → invisible; 1 al final).
      const docH =
        document.documentElement.scrollHeight - window.innerHeight;
      setProgress(docH > 0 ? Math.min(1, Math.max(0, y / docH)) : 0);
      // Guard: en el Hero/top no hay sección activa.
      if (y < window.innerHeight * TOP_GUARD) {
        setActive("");
        return;
      }
      // Scroll-spy de línea (robusto, sin gaps): última sección cuyo top pasó
      // la línea al 40% del viewport.
      const line = y + window.innerHeight * 0.4;
      let current = "";
      for (const item of siteConfig.nav) {
        const el = document.getElementById(navId(item.href));
        if (el && el.getBoundingClientRect().top + y <= line) {
          current = navId(item.href);
        }
      }
      setActive(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Click en el logo en la home → volver al top/hero (sin romper navegación externa).
  const onLogoClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (pathname !== "/") return; // otra ruta → navegación normal a "/"
    e.preventDefault();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    setActive("");
    setOpen(false);
  };

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-300",
        scrolled
          ? "border-b border-border/60 bg-depth-sunken/85 backdrop-blur-md"
          : "border-b border-transparent",
      )}
    >
      {!scrolled && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-24 bg-gradient-to-b from-background/70 to-transparent"
        />
      )}

      {/* Scroll-progress hairline (Sprint 01): 1px al pie del header, scaleX =
          progreso de lectura. En el top progress=0 → invisible (sin ruido).
          Solo transform/opacity; respeta reduced-motion. */}
      <span
        aria-hidden="true"
        style={{ transform: `scaleX(${progress})` }}
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px origin-left bg-gradient-to-r from-brand-electric/70 via-[#60a5fa]/70 to-accent-warm/60 transition-transform duration-150 ease-out motion-reduce:transition-none"
      />

      <div className={cn(SHELL, "grid h-16 grid-cols-[1fr_auto_1fr] items-center md:h-[4.5rem]")}>
        {/* Columna 1: logo */}
        <Link
          href="/"
          aria-label="SYNTRA CORE — Inicio"
          onClick={onLogoClick}
          className="col-start-1 justify-self-start rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <Image
            src="/logo.png"
            alt="SYNTRA CORE"
            width={800}
            height={378}
            priority
            // Display real: h-10/h-12 → ~85-102px de ancho. Es priority (entra
            // al grafo del LCP): sobredeclarar sizes triplicaba el peso servido.
            sizes="110px"
            className="h-10 w-auto md:h-12"
          />
        </Link>

        {/* Columna 2: navegación CENTRADA (real, vía grid) */}
        <nav
          aria-label="Navegación principal"
          className="col-start-2 hidden items-center justify-center gap-7 justify-self-center md:flex lg:gap-9"
        >
          {siteConfig.nav.map((item) => {
            const isActive = active !== "" && active === navId(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "relative rounded-sm text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background",
                  "after:pointer-events-none after:absolute after:-bottom-1.5 after:left-0 after:h-px after:w-full after:origin-left after:scale-x-0 after:transition-transform after:duration-300 after:ease-out hover:after:scale-x-100 motion-reduce:after:transition-none",
                  isActive
                    ? "text-foreground after:scale-x-100 after:bg-brand-electric/80"
                    : "text-muted-foreground hover:text-foreground after:bg-foreground/40",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Columna 3: CTA (desktop) + toggle (mobile), a la derecha */}
        <div className="col-start-3 flex items-center justify-self-end">
          {/* CTA compacto (size default → no compite con el primario del Hero) */}
          <div className="hidden md:block">
            <Button
              asChild
              variant="brand"
              size="default"
              className="transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_12px_30px_-12px_rgba(37,99,235,0.6)] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            >
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
            className="inline-flex size-9 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background md:hidden"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {/* Menú mobile */}
      {open && (
        <nav
          id="mobile-menu"
          aria-label="Navegación móvil"
          className="border-t border-border/60 bg-depth-sunken md:hidden"
        >
          <div className={cn(SHELL, "flex flex-col gap-1 py-4")}>
            {siteConfig.nav.map((item) => {
              const isActive = active !== "" && active === navId(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "rounded-lg px-3 py-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                    isActive
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
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
          </div>
        </nav>
      )}
    </header>
  );
}

export { Navbar };
