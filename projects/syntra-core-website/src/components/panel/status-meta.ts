import type { LeadStatus } from "@/lib/validations/lead";

/** Etiquetas en español del pipeline de status. */
export const STATUS_LABELS: Record<LeadStatus, string> = {
  new: "Nuevo",
  contacted: "Contactado",
  qualified: "Calificado",
  won: "Ganado",
  lost: "Perdido",
};

/** Clases de color por status (consistentes con el dark theme). */
export const STATUS_BADGE: Record<LeadStatus, string> = {
  new: "border-brand-electric/30 bg-brand-electric/10 text-brand-electric",
  contacted: "border-brand-cyan/30 bg-brand-cyan/10 text-brand-cyan",
  qualified: "border-violet-400/30 bg-violet-400/10 text-violet-300",
  won: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  lost: "border-rose-400/30 bg-rose-400/10 text-rose-300",
};
