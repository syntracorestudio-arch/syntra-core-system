/**
 * Colores de rol de Servicios (tokens de marca, regla 90/10). Fuente única para los
 * bloques de Servicios → consistencia visual sin duplicar clases. `team` = neutro/resultado.
 */
export type RoleId = "web" | "automation" | "ia" | "team";

export const ROLE_COLOR: Record<
  RoleId,
  { text: string; tint: string; ring: string; dot: string; hex: string }
> = {
  web: {
    text: "text-brand-electric",
    tint: "bg-brand-electric/10",
    ring: "ring-brand-electric/25",
    dot: "bg-brand-electric",
    hex: "#2563eb",
  },
  automation: {
    text: "text-accent-ai",
    tint: "bg-accent-ai/10",
    ring: "ring-accent-ai/25",
    dot: "bg-accent-ai",
    hex: "#6d5dfb",
  },
  ia: {
    text: "text-brand-cyan",
    tint: "bg-brand-cyan/10",
    ring: "ring-brand-cyan/25",
    dot: "bg-brand-cyan",
    hex: "#38bdf8",
  },
  team: {
    text: "text-foreground/80",
    tint: "bg-foreground/10",
    ring: "ring-foreground/20",
    dot: "bg-foreground/60",
    hex: "#cbd5e1",
  },
};
