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
};

export default nextConfig;
