import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type BadgeTone = "success" | "warning" | "destructive" | "neutral";

const tones: Record<BadgeTone, { tint: string; dot: string }> = {
  success: { tint: "bg-success/10", dot: "bg-success" },
  warning: { tint: "bg-warning/10", dot: "bg-warning" },
  destructive: { tint: "bg-destructive/10", dot: "bg-destructive" },
  neutral: { tint: "bg-secondary", dot: "bg-muted-foreground" },
};

/**
 * Átomo de estado: punto de color + tinte + TEXTO en foreground (contraste AA).
 * Unifica FinancialBadge y el badge de cupo de class-card.
 */
export function Badge({
  tone = "neutral",
  dot = false,
  className,
  children,
}: {
  tone?: BadgeTone;
  dot?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const t = tones[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium text-foreground",
        t.tint,
        className,
      )}
    >
      {dot ? <span className={cn("size-1.5 rounded-full", t.dot)} aria-hidden /> : null}
      {children}
    </span>
  );
}
