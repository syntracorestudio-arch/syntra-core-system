import type { Metadata, Viewport } from "next";
import { Inter, Sora, Space_Grotesk } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { HashScroll } from "@/components/shared/hash-scroll";

/** Analytics (Plausible) — se monta solo si hay dominio configurado. */
const plausibleDomain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
const plausibleSrc =
  process.env.NEXT_PUBLIC_PLAUSIBLE_SRC ?? "https://plausible.io/js/script.js";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

// Sora = font-heading (incluye el <h1> del Hero = elemento LCP). `display: "optional"`
// → el navegador da un bloqueo mínimo (~100ms) y, si la woff2 no llegó, pinta con el
// fallback size-matched SIN swap posterior. Saca la font del camino crítico del LCP y
// no introduce layout shift (CLS). En visitas con la font cacheada, Sora aparece normal.
const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  display: "optional",
});

// Space Grotesk = font-accent, no va above-the-fold. `preload: false` → no compite con
// las fonts críticas (Inter/Sora) por banda en el first-load.
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

const siteUrl = "https://syntracore.dev";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "SYNTRA CORE — Software Factory AI-Native",
    template: "%s · SYNTRA CORE",
  },
  description:
    "Construimos sistemas web premium, automatizaciones inteligentes y soluciones con IA para empresas que quieren crecer con tecnología moderna.",
  keywords: [
    "desarrollo web premium",
    "automatización de procesos",
    "sistemas con IA",
    "software factory",
    "Next.js",
    "n8n",
  ],
  authors: [{ name: "SYNTRA CORE" }],
  creator: "SYNTRA CORE",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "es_ES",
    url: siteUrl,
    siteName: "SYNTRA CORE",
    title: "SYNTRA CORE — Software Factory AI-Native",
    description:
      "Sistemas web premium, automatización inteligente y soluciones con IA para empresas reales.",
  },
  twitter: {
    card: "summary_large_image",
    title: "SYNTRA CORE — Software Factory AI-Native",
    description:
      "Sistemas web premium, automatización inteligente y soluciones con IA.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`dark ${inter.variable} ${sora.variable} ${spaceGrotesk.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {plausibleDomain ? (
          <>
            <Script id="plausible-init" strategy="afterInteractive">
              {`window.plausible=window.plausible||function(){(window.plausible.q=window.plausible.q||[]).push(arguments)}`}
            </Script>
            <Script defer data-domain={plausibleDomain} src={plausibleSrc} />
          </>
        ) : null}
        <HashScroll />
        {/* Grain global sutil (Sprint 01): textura premium, decorativa, fija. */}
        <div aria-hidden="true" className="syntra-grain" />
        {children}
      </body>
    </html>
  );
}
