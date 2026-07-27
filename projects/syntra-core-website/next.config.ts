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
    /**
     * CSP en **Report-Only**: NO bloquea nada, solo reporta violaciones a la
     * consola del browser. Es el paso previo obligatorio antes de aplicarla de
     * verdad — una CSP mal calibrada rompe producción en silencio.
     *
     * Alcance medido (no supuesto): el único recurso externo de cliente es
     * Plausible; Resend es server-side (no lo toca la CSP), schema.org es un
     * string del JSON-LD, y todas las imágenes son locales (next.config no
     * declara remotePatterns).
     *
     * `unsafe-inline` está en script/style porque Next inyecta scripts de
     * hidratación y el sitio usa `style={{}}` extensivamente. Migrar a nonces es
     * la mejora siguiente; aun así esta política ya restringe DE DÓNDE se
     * cargan los scripts y mata object-src / base-uri / form-action.
     *
     * Para aplicarla: mirar la consola en producción unos días, y si no hay
     * violaciones legítimas, renombrar la key a "Content-Security-Policy" y
     * agregar "upgrade-insecure-requests" a la lista (se omite acá porque los
     * browsers lo ignoran en report-only y solo ensucia la consola con un aviso).
     *
     * Estado medido (2026-07-27, build de producción, recorriendo todas las
     * secciones con un browser real): CERO violaciones. La política ya está
     * calibrada para pasar a enforcing.
     */
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://plausible.io",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self' https://plausible.io",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; ");

    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy-Report-Only", value: csp },
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
