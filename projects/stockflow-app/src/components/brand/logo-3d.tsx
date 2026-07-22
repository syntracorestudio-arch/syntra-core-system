import { cn } from "@/lib/cn";

/**
 * LogoMark3D — el isotipo "cubo + flecha" con volumen real (login).
 *
 * Medio: SVG con CARAS RELLENAS + gradientes por token, no CSS 3D. Motivo:
 * la geometría isométrica (cubo + flecha que lo cruza y sale subiendo) exige
 * bordes nítidos a cualquier tamaño y sombreado exacto por cara; mapear un SVG
 * plano sobre planos CSS 3D lo emborronaría. La profundidad se lee por el
 * sombreado isométrico clásico (cara superior clara, izquierda media, derecha
 * oscura), una sombra de contacto y la flecha en relieve por encima del cubo.
 *
 * La animación es una flotación muy sutil y lenta (8s); el volumen NO depende
 * de ella. Bajo prefers-reduced-motion el guard global de globals.css la
 * detiene y el logo queda quieto con toda su profundidad. Contenedor de tamaño
 * fijo (className) → cero layout shift.
 *
 * Todo sale de --primary / --primary-ink → white-label safe.
 */
export function LogoMark3D({ className }: { className?: string }) {
  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      <svg
        viewBox="0 0 48 52"
        fill="none"
        aria-hidden
        className="sf-logo3d__mark size-full overflow-visible"
      >
        <defs>
          {/* Flecha: un paso más brillante para despegarse del cubo */}
          <linearGradient
            id="sf3d-arrow"
            x1="2"
            y1="34"
            x2="45"
            y2="20"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor="var(--primary-ink)" />
            <stop
              offset="1"
              stopColor="color-mix(in srgb, var(--primary-ink) 55%, white)"
            />
          </linearGradient>
          {/* Sombra de contacto: radial neutro que se funde con el fondo */}
          <radialGradient id="sf3d-ground" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#05070c" stopOpacity="0.9" />
            <stop offset="1" stopColor="#05070c" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Sombra proyectada en el piso (respira con la flotación) */}
        <ellipse
          className="sf-logo3d__shadow"
          cx="24"
          cy="46.5"
          rx="13"
          ry="3"
          fill="url(#sf3d-ground)"
        />

        {/* ── Cubo isométrico: interior NEGRO (pedido del owner 2026-07-22),
            como el ícono dark de la lámina de marca. El volumen ya no lo dan
            caras azules sino un tinte MUY leve de primary distinto por cara +
            las aristas azules bien marcadas. color-mix mantiene el hue del
            white-label aunque el negro domine. ── */}
        {/* Cara superior (la que más luz recibe) */}
        <path
          d="M24 5 39 13.5 24 22 9 13.5Z"
          fill="color-mix(in srgb, var(--primary) 24%, #05070c)"
        />
        {/* Cara izquierda (media) */}
        <path
          d="M9 13.5 24 22V39L9 30.5Z"
          fill="color-mix(in srgb, var(--primary) 12%, #05070c)"
        />
        {/* Cara derecha (la más oscura) */}
        <path
          d="M24 22 39 13.5V30.5L24 39Z"
          fill="color-mix(in srgb, var(--primary) 6%, #05070c)"
        />

        {/* Aristas: acá vive el azul ahora — contorno + la "Y" interna,
            como el isotipo plano pero con jerarquía de luz por arista */}
        <g fill="none" strokeLinejoin="round" strokeLinecap="round">
          <path
            d="M24 5 39 13.5V30.5L24 39 9 30.5V13.5Z"
            stroke="var(--primary)"
            strokeWidth="1.8"
          />
          <path d="M9 13.5 24 22 39 13.5" stroke="var(--primary)" strokeWidth="1.5" />
          <path d="M24 22V39" stroke="var(--primary)" strokeWidth="1.5" />
          {/* Rim light azul claro en el techo: la profundidad se lee de un vistazo */}
          <path
            d="M9 13.5 24 5l15 8.5"
            stroke="var(--primary-ink)"
            strokeOpacity="0.85"
            strokeWidth="1"
          />
        </g>

        {/* ── Flecha de tendencia en relieve, por encima del cubo ── */}
        {/* Sombra de la flecha (offset) para que "flote" sobre la cara */}
        <g
          transform="translate(0.7 1.1)"
          stroke="#05070c"
          strokeOpacity="0.45"
          strokeWidth="3.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2 34h9.5L24 26l9 5.5L44.5 21" />
          <path d="M37 20.5h7.5V28" />
        </g>
        {/* Flecha viva */}
        <g
          stroke="url(#sf3d-arrow)"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2 34h9.5L24 26l9 5.5L44.5 21" />
          <path d="M37 20.5h7.5V28" />
        </g>
        {/* Filo de luz sobre la flecha */}
        <g
          stroke="#ffffff"
          strokeOpacity="0.35"
          strokeWidth="0.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2.5 33.4h9L24 25.4l9 5.5L44 20.6" />
        </g>
      </svg>
    </span>
  );
}
