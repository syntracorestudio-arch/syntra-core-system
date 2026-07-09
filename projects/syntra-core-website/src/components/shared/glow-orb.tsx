import * as React from "react";

import { cn } from "@/lib/utils";

interface GlowOrbProps extends React.ComponentProps<"div"> {
  /** Color del glow */
  tone?: "electric" | "deep";
  /** Tamaño aproximado del orbe */
  size?: "sm" | "md" | "lg";
}

// Sweep de color 2026-07-09: se retiró la variante "cyan" (sin uso; cyan prohibido en web).
const toneMap: Record<NonNullable<GlowOrbProps["tone"]>, string> = {
  electric: "bg-brand-electric/25",
  deep: "bg-brand-deep/30",
};

const sizeMap: Record<NonNullable<GlowOrbProps["size"]>, string> = {
  sm: "size-64",
  md: "size-96",
  lg: "size-[32rem]",
};

/**
 * GlowOrb — orbe radial difuminado para dar profundidad al fondo dark.
 * Decorativo (aria-hidden), CSS puro, sin JS. Uso moderado (design-rules.md).
 */
function GlowOrb({
  tone = "electric",
  size = "md",
  className,
  ...props
}: GlowOrbProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute rounded-full blur-[100px]",
        toneMap[tone],
        sizeMap[size],
        className,
      )}
      {...props}
    />
  );
}

/**
 * GradientBackground — capa de fondo con grid sutil + viñeta superior.
 * Se coloca detrás del contenido (z negativo). Decorativo.
 */
function GradientBackground({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 -z-10 overflow-hidden",
        className,
      )}
      {...props}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-electric/30 to-transparent" />
    </div>
  );
}

export { GlowOrb, GradientBackground };
