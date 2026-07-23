/**
 * HeroCamara — la BASE del fondo del Hero (v2, 2026-07-21).
 *
 * v1 era "LA CÁMARA": una cámara oscura pintada con gradientes (fuente de luz,
 * suelo pulido, línea de horizonte, bruma, brasa). Esas capas MURIERON acá: la
 * profundidad y la escala las construye el fondo en 3D real dentro del mismo canvas
 * que el vórtice — desde 2026-07-22, "LA TINTA" (hero-liquido.tsx). Repetir esos
 * gradientes en CSS sumaba un segundo foco de luz que peleaba con el 3D — y el
 * suelo con horizonte era, además, el cliché que la dirección prohíbe.
 *
 * Queda lo que el 3D NO puede dar: la base de aire oscuro (nítida a cualquier
 * resolución, 0KB en el LCP, sin banding), el grano compartido con la Home y el
 * fundido que cose con Servicios. Sigue siendo el fondo COMPLETO en mobile y en
 * reduced-motion, donde el canvas no se monta.
 *
 * Server Component: markup estático, SSR, 0 JS, sin animación → CLS 0.
 */

/** Grano compartido con el resto de la Home (anti-banding + materia).
 *  Se exporta porque en desktop el mismo grano se aplica ENCIMA del canvas: es lo
 *  que convierte el gradiente en atmósfera fotografiada en vez de render limpio
 *  (spec del design-director para "LA TINTA"). */
export const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")";

function HeroCamara() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* 1 · Base de la cámara: dark navy #060B14 (spec) con una deriva un toque
             más clara hacia la derecha (nunca negro plano; es aire oscuro). */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(140% 120% at 78% 42%, #0c1626 0%, #060b14 40%, #04070e 80%)",
        }}
      />

      {/* 1b · MESH GRADIENT — el eco estático de "LA TINTA" para mobile y
             reduced-motion, donde el canvas no monta. Mismos stops de la rampa
             (#0F2A5C / #17459E) en las posiciones de reposo de las masas, pero a
             baja opacidad: acá el protagonista es el póster del vórtice y el H1 es
             el LCP. CSS puro ⇒ 0 KB, 0 decode, nítido a cualquier viewport y sin
             CLS (un WebP de un degradé azul oscuro es el peor caso del códec:
             manchones de croma justo donde queremos suavidad). El grano de la capa
             siguiente lo dithera. */}
      <div
        className="absolute inset-0 lg:hidden"
        style={{
          background: [
            // 2026-07-23: eco del nuevo cuerpo #143A7D (20,58,125) + opacidad
            // apenas menor → el glob azul superior deja de "gritar" en mobile.
            "radial-gradient(72% 46% at 88% 26%, rgba(20,58,125,0.31) 0%, rgba(15,42,92,0.15) 46%, transparent 74%)",
            "radial-gradient(58% 34% at 18% 88%, rgba(15,42,92,0.24) 0%, transparent 70%)",
          ].join(","),
        }}
      />

      {/* 2 · GRANO: el mismo de la película de la Home (anti-banding real) */}
      <div
        className="absolute inset-0 opacity-[0.16] mix-blend-overlay"
        style={{ backgroundImage: GRAIN, backgroundRepeat: "repeat" }}
      />

      {/* 3 · Fundido inferior: cose con Servicios (llega a #04070e puro) */}
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#04070e] to-transparent" />
    </div>
  );
}

export { HeroCamara };
