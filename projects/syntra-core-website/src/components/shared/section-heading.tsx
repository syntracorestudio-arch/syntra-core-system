import * as React from "react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface SectionHeadingProps {
  /** Texto pequeño superior (eyebrow / label) */
  eyebrow?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Alineación del bloque */
  align?: "left" | "center";
  className?: string;
}

/**
 * SectionHeading — sistema tipográfico de encabezados de sección.
 * Eyebrow (Badge) + título (Sora) + subtítulo. Server Component.
 */
function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = "center",
  className,
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4",
        align === "center" ? "mx-auto max-w-2xl items-center text-center" : "items-start text-left",
        className,
      )}
    >
      {eyebrow ? <Badge variant="brand">{eyebrow}</Badge> : null}
      <h2 className="font-heading text-3xl font-bold tracking-tight text-balance sm:text-4xl">
        {title}
      </h2>
      {subtitle ? (
        <p className="text-base leading-relaxed text-muted-foreground text-pretty sm:text-lg">
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}

export { SectionHeading };
