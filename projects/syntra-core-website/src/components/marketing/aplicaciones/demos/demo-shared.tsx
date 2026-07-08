"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import { EASE_PREMIUM, DURATION } from "@/lib/motion";

/**
 * Piezas compartidas de las demos vivas de Casos v2. Los acentos siguen la
 * Doctrina de Libertad de Diseño v2 (paleta libre); cyan conserva su semántica
 * de "resultado / HECHO" en los componentes de sistema.
 */

/** Acento cromático de cada demo (halo de fondo + detalles del artefacto). */
export const DEMO_ACCENT = {
  landing: { hex: "#2563eb", rgb: "37,99,235" }, // electric
  asistente: { hex: "#e7c8a0", rgb: "231,200,160" }, // warm / humano (regla: sin violeta)
  automatizacion: { hex: "#e7c8a0", rgb: "231,200,160" }, // warm → electric
  panel: { hex: "#60a5fa", rgb: "96,165,250" }, // electric claro / datos (regla: sin cyan)
} as const;

export type DemoAccentId = keyof typeof DEMO_ACCENT;

/** Chip de cierre HECHO (warm dorado = resultado; regla owner: sin cyan). */
export function DoneChip({
  label,
  shown,
  reduce,
  className,
}: {
  label: string;
  shown: boolean;
  reduce: boolean;
  className?: string;
}) {
  return (
    <motion.div
      initial={false}
      animate={shown ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 8, scale: 0.95 }}
      transition={{ duration: reduce ? 0 : DURATION.standard, ease: EASE_PREMIUM }}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-accent-warm/50 bg-accent-warm/10 px-3 py-1.5 text-[11px] font-medium text-accent-warm shadow-[0_0_26px_-6px_rgba(231,200,160,0.6)]",
        className,
      )}
    >
      <span className="grid size-4 shrink-0 place-items-center rounded-full bg-accent-warm/20">
        <Check className="size-2.5" aria-hidden="true" strokeWidth={2.6} />
      </span>
      {label}
    </motion.div>
  );
}

/** Semáforo de la barra del navegador / topbar del panel. */
export function TrafficDots() {
  return (
    <span className="flex items-center gap-1.5" aria-hidden="true">
      <span className="size-2.5 rounded-full bg-[#ff5f57]" />
      <span className="size-2.5 rounded-full bg-[#febc2e]" />
      <span className="size-2.5 rounded-full bg-[#28c840]" />
    </span>
  );
}
