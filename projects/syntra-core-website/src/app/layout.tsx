import type { Metadata, Viewport } from "next";
import { Inter, Sora, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { HashScroll } from "@/components/shared/hash-scroll";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
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
        <HashScroll />
        {children}
      </body>
    </html>
  );
}
