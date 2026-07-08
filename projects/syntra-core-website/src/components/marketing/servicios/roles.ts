/**
 * Colores de rol de Servicios v2 "Circuito modular". Fuente única para el circuito
 * y el cierre (ServicesDecide) → consistencia visual sin duplicar clases.
 *
 * Paleta alineada a las demos vivas de Ejemplos (DEMO_ACCENT): SIN violeta ni cyan
 * (regla owner 2026-07-08). `rgb` acompaña al `hex` para halos/pulsos con alpha
 * inline; `dot`/`text` van como arbitrary values porque ámbar (#d97706) y electric
 * claro (#60a5fa) no tienen token de marca propio. `team` = nodo final / resultado.
 */
export type RoleId = "web" | "automation" | "ia" | "panel" | "team";

export const ROLE_COLOR: Record<
  RoleId,
  { text: string; tint: string; ring: string; dot: string; hex: string; rgb: string }
> = {
  web: {
    text: "text-brand-electric",
    tint: "bg-brand-electric/10",
    ring: "ring-brand-electric/25",
    dot: "bg-brand-electric",
    hex: "#2563eb", // electric
    rgb: "37,99,235",
  },
  ia: {
    text: "text-accent-warm",
    tint: "bg-accent-warm/10",
    ring: "ring-accent-warm/25",
    dot: "bg-accent-warm",
    hex: "#e7c8a0", // warm / asistente humano
    rgb: "231,200,160",
  },
  automation: {
    text: "text-[#d97706]",
    tint: "bg-[#d97706]/10",
    ring: "ring-[#d97706]/25",
    dot: "bg-[#d97706]",
    hex: "#d97706", // ámbar profundo
    rgb: "217,119,6",
  },
  panel: {
    text: "text-[#60a5fa]",
    tint: "bg-[#60a5fa]/10",
    ring: "ring-[#60a5fa]/25",
    dot: "bg-[#60a5fa]",
    hex: "#60a5fa", // electric claro / datos
    rgb: "96,165,250",
  },
  team: {
    text: "text-accent-warm",
    tint: "bg-accent-warm/10",
    ring: "ring-accent-warm/25",
    dot: "bg-accent-warm",
    hex: "#e7c8a0", // "tu negocio" = resultado (warm)
    rgb: "231,200,160",
  },
};
