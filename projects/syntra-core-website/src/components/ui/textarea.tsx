import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Textarea SYNTRA — consistente con Input. Accesible (aria-invalid).
 */
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-28 w-full rounded-xl border border-input bg-secondary/40 px-4 py-3 text-sm text-foreground shadow-sm transition-colors outline-none",
        "placeholder:text-muted-foreground/70",
        "focus-visible:border-brand-electric focus-visible:ring-2 focus-visible:ring-brand-electric/30",
        "aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-destructive/30",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
