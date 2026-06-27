import type { ElementType, HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type CardProps = HTMLAttributes<HTMLElement> & {
  as?: ElementType;
  /** Sombra/lift en hover (para cards clicables). */
  interactive?: boolean;
  /** `default` = p-4 sm:p-5 · `compact` = p-4 · `none` = sin padding. */
  padding?: "default" | "compact" | "none";
};

/** Superficie elevada estándar (reemplaza el "card premium" duplicado a mano). */
export function Card({
  as: As = "div",
  interactive = false,
  padding = "default",
  className,
  ...props
}: CardProps) {
  return (
    <As
      className={cn(
        "rounded-2xl border border-border bg-card shadow-sm",
        padding === "default" && "p-4 sm:p-5",
        padding === "compact" && "p-4",
        interactive && "transition-base hover:-translate-y-px hover:shadow-md",
        className,
      )}
      {...props}
    />
  );
}
