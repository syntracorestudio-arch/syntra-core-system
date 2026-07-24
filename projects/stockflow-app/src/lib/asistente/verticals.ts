/**
 * verticals.ts — vocabulario y prioridades por rubro para el reporte del asistente.
 *
 * La matemática del reporte es rubro-agnóstica (sale de las RPCs, iguales para todos);
 * lo que cambia por rubro es CÓMO se le habla al dueño y qué se prioriza. Los umbrales
 * duros (stock bajo, días de vencimiento, margen mínimo) ya viven por negocio en
 * `store_settings` y el reporte los respeta tal cual — acá no se duplican.
 */

export type Vertical = "kiosco" | "dietetica" | "petshop" | "otro";

type VerticalConfig = {
  /** Etiqueta cara-al-dueño del rubro. */
  label: string;
  /** Sustantivo para el stock ("productos", "artículos"). */
  productos: string;
  /** Cómo se nombra el negocio en el saludo ("tu kiosco"). */
  negocio: string;
  /**
   * Peso de urgencia de los vencimientos (perecedero). En rubros con más
   * mercadería que vence, la alerta de "por vencer" pesa más en el reporte.
   */
  vencimientosSensible: boolean;
};

const CONFIG: Record<Vertical, VerticalConfig> = {
  kiosco: { label: "Kiosco", productos: "productos", negocio: "tu kiosco", vencimientosSensible: false },
  dietetica: { label: "Dietética", productos: "productos", negocio: "tu dietética", vencimientosSensible: true },
  petshop: { label: "Pet shop", productos: "productos", negocio: "tu local", vencimientosSensible: true },
  otro: { label: "Negocio", productos: "productos", negocio: "tu negocio", vencimientosSensible: false },
};

export function verticalConfig(vertical: string | null | undefined): VerticalConfig {
  return CONFIG[(vertical as Vertical) ?? "otro"] ?? CONFIG.otro;
}
