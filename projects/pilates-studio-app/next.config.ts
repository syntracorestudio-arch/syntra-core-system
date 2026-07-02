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
};

export default nextConfig;
