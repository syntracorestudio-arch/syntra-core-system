"use client";

import * as React from "react";
import { useInView } from "framer-motion";
import dynamic from "next/dynamic";

/**
 * ContactoBackdrop — fondo vivo de Contacto ("El campo se inclina hacia vos",
 * reference-lock contacto.md). Vive a nivel SECCIÓN, por FUERA de la card del form:
 * la card (opaca) aísla el formulario y el campo respira en el espacio negativo
 * alrededor (arriba/abajo/costados). Lazy (ssr:false) + gate de montaje por viewport.
 * Canvas pointer-events:none → el form sigue 100% clickeable. reduced-motion → solo el
 * poster navy (sin Canvas, lo maneja el componente del campo).
 */
const ContactFieldBackground = dynamic(
  () =>
    import("@/components/marketing/living/contact-field-background").then(
      (m) => m.ContactFieldBackground,
    ),
  { ssr: false, loading: () => null },
);

export function ContactoBackdrop() {
  const ref = React.useRef<HTMLDivElement>(null);
  // Pre-monta ~650px antes de entrar al viewport; once: no desmonta ni reinicia.
  const inView = useInView(ref, { margin: "650px 0px", once: true });

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
    >
      {/* Base navy del sistema (siempre presente → fondo de sección + fallback si el 3D no carga) */}
      <div
        className="absolute inset-0"
        style={{
          // Near-black frío (gris casi negro): hace resaltar los puntos/nodos azules.
          background: "radial-gradient(90% 80% at 50% 26%, #0b0f18 0%, #06070d 78%)",
        }}
      />
      {inView ? <ContactFieldBackground /> : null}
      {/* Fade de ENTRADA (costura con FAQ): el campo no arranca en seco — los
          primeros px continúan el aterrizaje del puente térmico. */}
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[#070a11] via-[#070a11]/55 to-transparent" />
    </div>
  );
}

export default ContactoBackdrop;
