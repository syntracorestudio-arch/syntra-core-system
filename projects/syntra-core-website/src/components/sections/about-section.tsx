import { NosotrosSection } from "@/components/marketing/aplicaciones/nosotros/nosotros-section";

/**
 * AboutSection — "Nosotros / Brasa" (reference-lock nosotros.md v3, aprobada
 * por el owner en el loop de variantes vivas, 2026-07-06).
 *
 * La sección real vive en marketing/aplicaciones/nosotros/nosotros-section.tsx
 * (client: atmósfera generada + brasas + cards premium con spotlight y
 * artefactos visuales por principio). Este wrapper mantiene el contrato
 * histórico del layout de la Home (page.tsx importa AboutSection).
 */
function AboutSection() {
  return <NosotrosSection />;
}

export { AboutSection };
