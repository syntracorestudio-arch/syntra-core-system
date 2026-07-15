import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { IconChip } from "@/components/ui/icon-chip";

/**
 * Banda de sección v2 — "hermana del hero" del dashboard, en escala menor y sin foto:
 * wash del acento → card, WATERMARK del icono de sección (gigante, teñido con --primary
 * a baja opacidad, sangrando abajo-derecha) y hairline de acento que ecoa la píldora de
 * la sidebar viva. Todo token-driven (white-label) y sin assets. La marca del estudio y
 * "Salir" viven en el sidebar, no acá.
 *  - icon: LucideIcon de la sección (chip + watermark salen del mismo).
 *  - stat: dato contextual YA computado por la página (solo lectura; oculto en mobile).
 *  - children: acciones/filtros de la página (buscador, selector de período, etc.).
 */
export function PageHeader({
  title,
  subtitle,
  icon: Icon,
  stat,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  stat?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="relative overflow-hidden rounded-2xl border border-border px-5 py-4 shadow-sm duration-500 animate-in fade-in slide-in-from-bottom-2 sm:px-6 sm:py-5">
      <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-accent/60 via-card to-card" />
      {Icon ? (
        <div aria-hidden className="absolute -bottom-8 -right-4 rotate-[-8deg] text-primary opacity-[0.08]">
          <Icon className="size-32 sm:size-36" strokeWidth={1.25} />
        </div>
      ) : null}
      <div aria-hidden className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-primary" />
      <div className="relative flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 items-center gap-3">
          {Icon ? (
            <IconChip tone="primary">
              <Icon className="size-4" aria-hidden />
            </IconChip>
          ) : null}
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{title}</h1>
            {subtitle ? <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p> : null}
          </div>
        </div>
        {stat ? <div className="hidden shrink-0 text-right sm:block">{stat}</div> : null}
        {children ? <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">{children}</div> : null}
      </div>
    </header>
  );
}

/** Stat estándar de la banda: número protagonista + caption. */
export function HeaderStat({ value, caption }: { value: ReactNode; caption: string }) {
  return (
    <div>
      <p className="text-xl font-bold tabular-nums tracking-tight text-foreground sm:text-2xl">{value}</p>
      <p className="text-xs text-muted-foreground">{caption}</p>
    </div>
  );
}
