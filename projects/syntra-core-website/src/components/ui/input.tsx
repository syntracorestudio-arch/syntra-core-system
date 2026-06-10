import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Input SYNTRA — moderno, minimalista, accesible. Soporta aria-invalid.
 * Ref: design-rules.md (inputs modernos, rápidos y accesibles).
 */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-11 w-full rounded-xl border border-input bg-secondary/40 px-4 text-sm text-foreground shadow-sm transition-colors outline-none",
        "placeholder:text-muted-foreground/70",
        "hover:border-border-strong",
        "focus-visible:border-brand-electric focus-visible:bg-secondary/60 focus-visible:ring-2 focus-visible:ring-brand-electric/30",
        "aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-destructive/30",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
