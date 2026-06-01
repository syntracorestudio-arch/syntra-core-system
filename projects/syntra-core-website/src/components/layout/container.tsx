import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Container — ancho máximo controlado + padding responsive.
 * Mantiene la UI centrada y "respirando" (design-rules.md / ui-direction.md).
 */
function Container({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("mx-auto w-full max-w-6xl px-5 sm:px-8", className)}
      {...props}
    />
  );
}

export { Container };
