/**
 * Configuración base de StudioFlow.
 * White-label: el nombre/marca visible final lo aporta cada estudio;
 * estos valores son los del producto (nivel SYNTRA / proveedor).
 */
export const siteConfig = {
  name: "StudioFlow",
  tagline: "Sistema de reservas para estudios boutique",
  description:
    "StudioFlow es el sistema de reservas y cobranza white-label para estudios boutique de pilates: agenda, cupos, packs y control de pagos, con la marca de tu estudio.",
  phase: "Fase 1A — scaffolding inicial",
} as const;

export type SiteConfig = typeof siteConfig;
