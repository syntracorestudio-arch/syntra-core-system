import * as React from "react";

import { cn } from "@/lib/utils";
import { Container } from "@/components/layout/container";

interface SectionProps extends React.ComponentProps<"section"> {
  /** Si es false, el contenido se renderiza sin Container (full-bleed). */
  contained?: boolean;
}

/**
 * Section — ritmo de spacing vertical uniforme entre bloques.
 * Secciones amplias que respiran (mobile-first). Ref: ui-patterns.md.
 */
function Section({
  className,
  children,
  contained = true,
  ...props
}: SectionProps) {
  return (
    <section
      className={cn(
        // scroll-mt-20 compensa la navbar fija al saltar a anclas vía <Link> (scrollIntoView).
        // Padding generoso y uniforme: cada sección "respira" y la siguiente no
        // asoma por abajo al aterrizar en un ancla.
        "relative w-full scroll-mt-20 py-20 sm:py-28 lg:py-32",
        className,
      )}
      {...props}
    >
      {contained ? <Container>{children}</Container> : children}
    </section>
  );
}

export { Section };
