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
        "bg-[linear-gradient(135deg,#182236_0%,#111621_60%)]",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
        "duration-500 animate-in fade-in slide-in-from-bottom-2",
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
        "rounded-xl border border-border bg-card p-4 lg:p-5",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
        "duration-500 animate-in fade-in slide-in-from-bottom-2",
        interactive &&
          "transition-[border-color,transform] duration-150 hover:-translate-y-px hover:border-[#2e3c55]",
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
        "rounded-xl border border-border bg-[#0e1219] p-4 lg:p-5",
        "duration-500 animate-in fade-in slide-in-from-bottom-2",
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
        "duration-500 animate-in fade-in slide-in-from-bottom-2",
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
