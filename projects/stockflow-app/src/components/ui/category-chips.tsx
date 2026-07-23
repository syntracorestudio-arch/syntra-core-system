"use client";

import { cn } from "@/lib/cn";

export type ChipCategory = {
  id: string;
  name: string;
  emoji?: string | null;
  color?: string | null;
};

/**
 * Fila de chips de categoría — el filtro del pulgar (Productos y POS).
 *
 * Chips y no un <select>: en el mostrador se filtra con una mano mientras la
 * otra sostiene la mercadería; un dropdown son dos toques y un menú que tapa.
 * Scrolleable horizontal sin scrollbar, single-select, "Todos" siempre primero.
 * El dot lleva el color de la categoría — el color identifica, el texto nombra.
 */
export function CategoryChips({
  categories,
  value,
  onChange,
  size = "md",
  className,
}: {
  categories: ChipCategory[];
  value: string | null;
  onChange: (id: string | null) => void;
  /** md = admin (h-9) · lg = POS táctil (h-10) */
  size?: "md" | "lg";
  className?: string;
}) {
  // Sin categorías no hay nada que filtrar: la fila no ocupa lugar.
  if (categories.length === 0) return null;

  const alto = size === "lg" ? "h-10" : "h-9";

  return (
    <div
      role="tablist"
      aria-label="Filtrar por categoría"
      className={cn(
        "flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      <Chip alto={alto} activa={value === null} onClick={() => onChange(null)}>
        Todos
      </Chip>
      {categories.map((c) => {
        const activa = value === c.id;
        const color = c.color ?? "var(--primary)";
        return (
          <Chip
            key={c.id}
            alto={alto}
            activa={activa}
            onClick={() => onChange(activa ? null : c.id)}
            style={
              activa
                ? {
                    backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`,
                    boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${color} 45%, transparent)`,
                  }
                : undefined
            }
          >
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: color }}
            />
            {c.name}
          </Chip>
        );
      })}
    </div>
  );
}

function Chip({
  activa,
  alto,
  onClick,
  style,
  children,
}: {
  activa: boolean;
  alto: string;
  onClick: () => void;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={activa}
      onClick={onClick}
      style={style}
      className={cn(
        "flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition-colors duration-150",
        alto,
        activa
          ? "text-foreground" // el fondo/ring activos vienen por style (color de la categoría)
          : "border border-border text-muted-foreground hover:border-primary/50 hover:text-foreground",
        activa && !style && "bg-accent text-accent-foreground", // "Todos" activa
      )}
    >
      {children}
    </button>
  );
}
