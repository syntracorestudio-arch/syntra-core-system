import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type ChipTone = "primary" | "success" | "warning" | "destructive" | "muted" | "accent";
export type ChipSize = "sm" | "md";

const tones: Record<ChipTone, string> = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  destructive: "bg-destructive/15 text-destructive",
  muted: "bg-secondary text-muted-foreground",
  accent: "bg-accent text-primary",
};

const sizes: Record<ChipSize, string> = {
  sm: "size-6 rounded-md [&>svg]:size-3.5",
  md: "size-8 rounded-lg [&>svg]:size-4",
};

/** Tile de acento para íconos líderes (headers de card, KPIs, stats). Un solo
 *  tratamiento en todo el panel; token-driven (respeta el acento del estudio). */
export function IconChip({
  children,
  tone = "primary",
  size = "sm",
  className,
}: {
  children: ReactNode;
  tone?: ChipTone;
  size?: ChipSize;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center", sizes[size], tones[tone], className)}>
      {children}
    </span>
  );
}
