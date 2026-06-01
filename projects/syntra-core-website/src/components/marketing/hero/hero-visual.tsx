import { GlowOrb } from "@/components/shared/glow-orb";

/**
 * HeroVisual — visual estático de la columna derecha del Hero (FASE 1).
 *
 * Reserva el espacio del futuro grafo (FASE 2) con un aspect-ratio fijo para
 * evitar CLS. Sin estado, sin efectos, sin librerías. Server Component.
 * Reutiliza el GlowOrb compartido como fondo ambiental (no crea uno nuevo).
 */
function HeroVisual() {
  return (
    <div
      role="img"
      aria-label="Representación visual del sistema SYNTRA CORE"
      className="relative mx-auto aspect-[620/560] w-full max-w-[560px]"
    >
      {/* Glow ambiental (componente compartido reutilizado) */}
      <GlowOrb
        tone="electric"
        size="md"
        className="top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-50"
      />

      {/* Surface — fondo algo más definido que el dark base (no glass plano) */}
      <div className="relative flex h-full w-full items-center justify-center rounded-3xl border border-border bg-card/60 backdrop-blur-md">
        {/* Constelación estática de hexágonos (geometría del logo). Sin animación. */}
        <svg
          viewBox="0 0 320 320"
          className="h-[72%] w-[72%]"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          {/* Líneas conectoras (sugieren red/sistema) */}
          <g stroke="var(--input)" strokeWidth="1.5">
            <line x1="160" y1="160" x2="160" y2="64" />
            <line x1="160" y1="160" x2="243" y2="208" />
            <line x1="160" y1="160" x2="77" y2="208" />
          </g>

          {/* Hexágono central (grande, neutro) */}
          <path
            d="M160 96 L213 127 V189 L160 220 L107 189 V127 Z"
            fill="var(--brand-bg)"
            stroke="var(--input)"
            strokeWidth="2"
          />

          {/* Hexágonos satélite (tenues) */}
          <g
            fill="var(--brand-bg)"
            stroke="var(--input)"
            strokeWidth="1.5"
            opacity="0.85"
          >
            {/* arriba */}
            <path d="M160 36 L188 52 V84 L160 100 L132 84 V52 Z" />
            {/* abajo-derecha */}
            <path d="M243 180 L271 196 V228 L243 244 L215 228 V196 Z" />
            {/* abajo-izquierda */}
            <path d="M77 180 L105 196 V228 L77 244 L49 228 V196 Z" />
          </g>
        </svg>

        {/* Etiqueta */}
        <span className="absolute bottom-6 font-accent text-sm tracking-widest text-muted-foreground">
          IA
        </span>
      </div>
    </div>
  );
}

export { HeroVisual };
