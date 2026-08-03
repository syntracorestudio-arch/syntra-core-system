import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "StockFlow",
  description:
    "Stock, ventas y fiado para tu negocio. Tu kiosco en una pantalla — y te avisa antes de que pierdas plata.",
};

export const viewport: Viewport = {
  themeColor: "#0a0d13",
  width: "device-width",
  initialScale: 1,
  /* El POS se opera con una mano en el mostrador: nada de zoom accidental al tipear. */
  maximumScale: 5,
  /* La app llega hasta el borde físico de la pantalla. Es el prerrequisito de
     `env(safe-area-inset-*)`: sin esto, esas variables valen 0 y el padding que
     reserva la barra gestual de Android no haría nada. */
  viewportFit: "cover",
  /* El teclado achica el viewport de LAYOUT, no solo el visual. Sin esto, en
     Chrome Android las hojas ancladas abajo se quedan pegadas al fondo anterior
     y el teclado tapa su botón principal: el cajero no podía guardar el producto
     que acababa de escanear (docs/responsive-audit.md §C2). */
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${geist.variable} h-full`}>
      <body className="min-h-full font-sans antialiased">{children}</body>
    </html>
  );
}
