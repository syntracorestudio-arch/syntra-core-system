import { cn } from "@/lib/cn";

/**
 * Marca StockFlow — isotipo "cubo + flecha" (aprobado por el owner 2026-07-22).
 *
 * Es SVG inline y no un PNG por tres razones: nítido a cualquier tamaño (del
 * favicon al panel del login), theme-aware (el gradiente sale de los tokens
 * --primary/--primary-ink, así el white-label lo pinta solo), y pesa cero red.
 *
 * Geometría: cubo isométrico en trazo + flecha de tendencia que lo atraviesa
 * y sale subiendo — stock que se mueve y va para arriba.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden
      className={cn("shrink-0", className)}
    >
      <defs>
        <linearGradient id="sf-brand" x1="4" y1="40" x2="44" y2="8" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--primary)" />
          <stop offset="1" stopColor="var(--primary-ink)" />
        </linearGradient>
      </defs>
      {/* Cubo: contorno hexagonal + aristas internas */}
      <g stroke="url(#sf-brand)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M24 4.5 39 13v17L24 38.5 9 30V13L24 4.5Z" />
        <path d="M9 13l15 8.5L39 13" />
        <path d="M24 21.5V38.5" />
        {/* Flecha: entra plana desde la izquierda, cruza el cubo y sale subiendo */}
        <path d="M2 33.5h9.5L24 26l9 5.5L44.5 21" />
        <path d="M37 20.5h7.5V28" />
      </g>
    </svg>
  );
}

/**
 * Wordmark bicolor: "Stock" en foreground, "Flow" en el acento.
 * Hereda el tamaño de fuente del contenedor.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-bold tracking-tight", className)}>
      Stock<span className="text-primary-ink">Flow</span>
    </span>
  );
}
