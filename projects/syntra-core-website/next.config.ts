import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Forward-looking: si en el futuro se sirven raster, optimizar a AVIF/WebP.
  // (La escena premium de Servicios es 100% CSS y NO usa next/image.)
  images: {
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
