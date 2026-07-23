import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
export type ButtonSize = "sm" | "md";

/* Un solo vocabulario de botón (V5): antes cada pantalla armaba los suyos con
   clases sueltas y había tres hovers distintos para la misma acción. */
const base =
  "inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg font-medium transition-colors duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60";

const sizes: Record<ButtonSize, string> = {
  md: "min-h-11 px-4 text-sm", // ≥44px táctiles
  sm: "min-h-9 px-3 text-xs",
};

const variants: Record<ButtonVariant, string> = {
  primary: "bg-primary font-semibold text-primary-foreground hover:opacity-90",
  secondary: "border border-border text-foreground hover:bg-secondary",
  ghost: "text-muted-foreground hover:bg-secondary hover:text-foreground",
  destructive:
    "border border-border text-muted-foreground hover:border-danger/40 hover:bg-danger/5 hover:text-danger-ink",
};

/** Clases del botón (para submits con useFormStatus o casos con estilo extra). */
export function buttonClass(
  variant: ButtonVariant = "secondary",
  size: ButtonSize = "md",
  className?: string,
) {
  return cn(base, sizes[size], variants[variant], className);
}

export function Button({
  variant = "secondary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button type="button" className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({
  variant = "secondary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}
