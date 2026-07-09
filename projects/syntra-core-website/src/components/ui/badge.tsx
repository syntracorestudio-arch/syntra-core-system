import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

/**
 * Badge SYNTRA — labels/eyebrows con fuente de acento (Space Grotesk).
 * Ref: design-rules.md (acentos / badges), ui-patterns.md.
 */
const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1.5 rounded-full border font-accent text-xs font-medium tracking-wide whitespace-nowrap [&_svg]:pointer-events-none [&_svg]:size-3.5",
  {
    variants: {
      variant: {
        default: "border-border bg-secondary px-3 py-1 text-secondary-foreground",
        brand:
          "border-brand-electric/30 bg-brand-electric/10 px-3 py-1 text-brand-electric",
        outline: "border-border px-3 py-1 text-muted-foreground",
        // Eyebrow neutro (Color+Depth v1: badges sin azul, regla 90/10)
        neutral:
          "border-border-strong bg-surface-1 px-3 py-1 text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "span";

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
