import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Label SYNTRA — etiqueta de formulario accesible (htmlFor → id del control).
 */
function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn(
        "text-sm font-medium text-foreground select-none",
        className,
      )}
      {...props}
    />
  );
}

export { Label };
