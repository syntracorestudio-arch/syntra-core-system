import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Forward-looking: si en el futuro se sirven raster, optimizar a AVIF/WebP.
  // (La escena premium de Servicios es 100% CSS y NO usa next/image.)
  images: {
    formats: ["image/avif", "image/webp"],
  },
  experimental: {
    // Tree-shake del barrel de drei/postprocessing: importa solo lo usado por
    // LivingBackground (Environment/Lightformer/useTexture · EffectComposer/Bloom/SMAA),
    // no el barrel completo (~193KB sin usar) que arrastraba el chunk three/R3F.
    optimizePackageImports: ["@react-three/drei", "@react-three/postprocessing"],
  },

  /**
   * Security headers (baseline `syntra-scale-security-baseline`, obligatorio
   * pre-producción). Se aplican a TODA ruta.
   *
   * Sin CSP por ahora: la página usa JSON-LD y Plausible inline, y una CSP mal
   * calibrada rompe producción en silencio. Es el siguiente paso, con
   * Report-Only primero — no se agrega a ciegas junto al resto.
   *
   * HSTS sin `preload`: entrar a la lista de preload de los browsers es
   * prácticamente irreversible; se decide al lanzar el dominio, no antes.
   */
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Fuerza HTTPS por 2 años (Vercel ya sirve TLS; esto cierra el downgrade).
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
          // Sin sniffing de MIME: un .txt no se ejecuta como script.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Anti-clickjacking (crítico para /panel: nadie debe poder enmarcarlo).
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // El sitio no usa cámara/micrófono/ubicación: se apagan explícitamente.
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
