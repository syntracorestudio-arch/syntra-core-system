import { cn } from "@/lib/cn";

/**
 * Sistema de cards (auditoría UI-UX 2026-07-23, parte B).
 *
 * Cuatro niveles con jerarquía real — la respuesta a "todo azul plano":
 *
 * - `CardHero`   → el número que el kiosquero vino a ver (máx 1-2 por
 *                  pantalla o se anula). Gradiente + bevel + noise y glow
 *                  semántico opcional detrás del contenido.
 * - `Card`       → superficie estándar (gráficos, bloques, formularios).
 *                  Bevel sutil; `interactive` suma hover con lift.
 * - `CardList`   → colecciones (productos, clientes, movimientos). Un paso
 *                  MÁS OSCURA que el estándar para que los niveles de arriba
 *                  salten hacia adelante.
 * - `CardAlert`  → requiere acción. Borde izquierdo semántico de 3px + fondo
 *                  teñido. El hue lo dicta la semántica (warning/danger/
 *                  success), nunca decoración.
 *
 * El glow verde queda SAGRADO para plata real (ganancia/cobrado); el resto de
 * los heroes van neutros o con el tinte que les corresponda.
 */

type DivProps = React.HTMLAttributes<HTMLDivElement>;

/** Glow radial detrás del contenido de un hero. */
export type HeroGlow = "success" | "danger" | "warning" | "primary";

const GLOW: Record<HeroGlow, string> = {
  success: "color-mix(in srgb, var(--success) 10%, transparent)",
  danger: "color-mix(in srgb, var(--danger) 9%, transparent)",
  warning: "color-mix(in srgb, var(--warning) 9%, transparent)",
  primary: "color-mix(in srgb, var(--primary) 10%, transparent)",
};

export function CardHero({
  glow,
  className,
  children,
  ...props
}: DivProps & { glow?: HeroGlow }) {
  return (
    <section
      className={cn(
        "bg-noise relative overflow-hidden rounded-xl border border-border p-4 lg:p-5",
        /* El degradé arranca en un tono más claro que `--surface-2` a
           propósito: es lo que hace que el hero se despegue de las cards
           normales. El extremo oscuro SÍ es la superficie tokenizada. */
        "bg-[linear-gradient(135deg,#182236_0%,var(--surface-2)_60%)]",
        "shadow-elev-1",
        /* 200ms y no 500: techo de 240ms en rutas autenticadas (§2.A). Medio
           segundo para que aparezca una card es tiempo mirando una pantalla
           que todavía no se puede usar. */
        "duration-200 animate-in fade-in slide-in-from-bottom-2",
        className,
      )}
      {...props}
    >
      {glow && (
        <span
          aria-hidden
          className="pointer-events-none absolute -left-6 top-1/2 size-40 -translate-y-1/2 rounded-full blur-[40px]"
          style={{ background: GLOW[glow] }}
        />
      )}
      <div className="relative">{children}</div>
    </section>
  );
}

export function Card({
  interactive = false,
  className,
  children,
  ...props
}: DivProps & { interactive?: boolean }) {
  return (
    <section
      className={cn(
        "rounded-xl border border-border bg-surface-2 p-4 lg:p-5",
        "shadow-elev-0",
        "duration-200 animate-in fade-in slide-in-from-bottom-2",
        interactive &&
          "transition-[border-color,transform] duration-150 hover:-translate-y-px hover:border-border-hover",
        className,
      )}
      {...props}
    >
      {children}
    </section>
  );
}

export function CardList({ className, children, ...props }: DivProps) {
  return (
    <section
      className={cn(
        /* `--surface-1`: un paso MÁS OSCURA que la card estándar, para que los
           niveles de arriba salten hacia adelante. Era el único nivel de la
           escala sin nombre — vivía como `bg-surface-1` repetido en cinco
           archivos, así que "cambiar el fondo de las colecciones" significaba
           buscar y reemplazar a mano. */
        "rounded-xl border border-border bg-surface-1 p-4 lg:p-5",
        "duration-200 animate-in fade-in slide-in-from-bottom-2",
        className,
      )}
      {...props}
    >
      {children}
    </section>
  );
}

export type AlertTone = "warning" | "danger" | "success";

const ALERT_BG: Record<AlertTone, string> = {
  warning: "color-mix(in srgb, var(--warning) 6%, var(--card))",
  danger: "color-mix(in srgb, var(--danger) 6%, var(--card))",
  success: "color-mix(in srgb, var(--success) 5%, var(--card))",
};
const ALERT_EDGE: Record<AlertTone, string> = {
  warning: "var(--warning)",
  danger: "var(--danger)",
  success: "var(--success)",
};

export function CardAlert({
  tone,
  className,
  children,
  ...props
}: DivProps & { tone: AlertTone }) {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-xl border border-border p-4 lg:p-5",
        "duration-200 animate-in fade-in slide-in-from-bottom-2",
        className,
      )}
      style={{ background: ALERT_BG[tone] }}
      {...props}
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{ background: ALERT_EDGE[tone] }}
      />
      {children}
    </section>
  );
}
