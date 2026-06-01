import { siteConfig } from "@/config/site";

/**
 * JsonLd — structured data (schema.org) para SEO.
 * Server Component: renderiza un <script type="application/ld+json"> estático.
 */
function JsonLd() {
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": ["Organization", "ProfessionalService"],
        "@id": `${siteConfig.url}/#organization`,
        name: siteConfig.name,
        url: siteConfig.url,
        email: siteConfig.email,
        description: siteConfig.description,
        image: `${siteConfig.url}/opengraph-image`,
        knowsAbout: [
          "Desarrollo web",
          "Automatización de procesos",
          "Inteligencia artificial aplicada",
        ],
      },
      {
        "@type": "WebSite",
        "@id": `${siteConfig.url}/#website`,
        url: siteConfig.url,
        name: siteConfig.name,
        inLanguage: "es",
        publisher: { "@id": `${siteConfig.url}/#organization` },
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      // JSON estático generado en server, sin datos de usuario.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
    />
  );
}

export { JsonLd };
