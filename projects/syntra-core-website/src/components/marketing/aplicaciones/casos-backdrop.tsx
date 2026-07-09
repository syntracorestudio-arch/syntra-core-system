import { SectionAtmosphere } from "@/components/marketing/living/section-atmosphere";

/**
 * CasosBackdrop — fondo de Casos en el sistema UNIFICADO (2026-07-09). Se eliminó el
 * "Campo de señales" 3D (tubos): las DEMOS mandan, sin pieza protagonista de fondo.
 * Casos conserva su identidad térmica CÁLIDA vía el acento `warm` de la atmósfera común
 * (misma luminancia que el resto de la Home). Server-safe (ya no monta canvas).
 */
export function CasosBackdrop() {
  return <SectionAtmosphere accent="warm" />;
}
