import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
  },
  /**
   * Headers de seguridad desde el primer commit (skill `syntra-scale-security-baseline`).
   * StudioFlow los tuvo que agregar en una auditoría posterior; acá nacen con el proyecto.
   * CSP completa queda pendiente: Next inyecta scripts inline → requiere nonces.
   *
   * `camera=(self)`: a diferencia de StudioFlow, el POS ESCANEA códigos de barras con la
   * cámara del teléfono, así que la política la habilita para el propio origen.
   */
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
