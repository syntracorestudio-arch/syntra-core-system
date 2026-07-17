import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
  },
  experimental: {
    // Subida de logo (Server Action): headroom sobre el máx de 2 MB del logo.
    serverActions: {
      bodySizeLimit: "3mb",
    },
  },
  // Headers de seguridad base (auditoría 2026-07-17). CSP completa queda para
  // más adelante (Next inyecta scripts inline → requiere nonces; proyecto aparte).
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
