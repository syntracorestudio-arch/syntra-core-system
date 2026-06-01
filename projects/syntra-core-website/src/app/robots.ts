import type { MetadataRoute } from "next";

import { siteConfig } from "@/config/site";

/** robots.txt — indexa el sitio público, bloquea el panel interno. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: "/panel",
    },
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}
