import * as React from "react";

import { Container } from "@/components/layout/container";
import { FadeIn } from "@/components/animations/fade-in";

/**
 * SectionBridge — frase-bisagra editorial entre secciones de la Home (WEB-012B).
 *
 * Cose el relato: nombra el resultado de la sección anterior como input de la
 * siguiente, para que la página se lea como una narrativa continua y no como
 * bloques aislados. Copy-first: una sola línea centrada y tenue, sin conectores
 * visuales, sin líneas/glow, sin cyan/electric (reservados a ACTIVO/HECHO). Vive
 * en el aire que ya dejan los `py` de cada Section, sin agrandarlo. La frase
 * "se lee, no se mira".
 */
function SectionBridge({ children }: { children: React.ReactNode }) {
  return (
    <div className="py-2 sm:py-4">
      <Container>
        <FadeIn>
          <p className="mx-auto max-w-2xl text-center text-base leading-relaxed text-muted-foreground text-balance sm:text-lg">
            {children}
          </p>
        </FadeIn>
      </Container>
    </div>
  );
}

export { SectionBridge };
