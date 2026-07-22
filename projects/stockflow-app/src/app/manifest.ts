import type { MetadataRoute } from "next";

/**
 * PWA. El POS se instala en el teléfono del mostrador: `standalone` para que no
 * tenga barra de navegador (menos superficie para tocar sin querer durante una
 * venta) y arranque directo en la caja.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "StockFlow — stock y ventas",
    short_name: "StockFlow",
    description:
      "Tu negocio en una pantalla. Vendé, controlá el stock y el fiado, y enterate antes de perder plata.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0a0d13",
    theme_color: "#0a0d13",
    lang: "es-AR",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
