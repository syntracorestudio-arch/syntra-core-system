"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/cn";

export type ChipCategory = {
  id: string;
  name: string;
  emoji?: string | null;
  color?: string | null;
  /** Contador REAL (viene de `categorias_resumen`, nunca de un subset del cliente). */
  count?: number;
};

/** Valor sentinela del filtro "Sin categoría" (la deuda del catálogo). */
export const SIN_CATEGORIA = "none";

/**
 * Fila de chips de categoría — el filtro del pulgar (Productos y POS).
 *
 * Escala Fase 2 visual (audit §C2): antes era un scroll horizontal sin affordance —
 * en 390px entraban ~3 chips y el resto NO EXISTÍA para el usuario. Ahora:
 *   · techo de chips visibles (`maxVisible`; POS 6, admin 8) + "Más ⌄" para el resto;
 *     con todo adentro del techo, "Más" no aparece.
 *   · la categoría ACTIVA siempre está visible (si no entró en el top, se ancla
 *     segunda) — filtrar por algo que no se ve es desorientador.
 *   · contador real en cada chip ("Golosinas 34"): con 2000 productos, el número es
 *     lo que decide si vale entrar.
 *   · "Más" abre bottom-sheet (mobile) / panel centrado (desktop): todas en 2
 *     columnas, con buscador propio si son >20, y "Sin categoría (N)" al final.
 *   · el scroll horizontal queda como atajo (con máscara de degradado en el borde),
 *     nunca como único acceso.
 *
 * El ORDEN de `categories` lo decide el caller (POS: por rotación de 14 días;
 * Productos: por cantidad de productos): el componente no re-ordena.
 */
export function CategoryChips({
  categories,
  value,
  onChange,
  size = "md",
  maxVisible = 8,
  sinCategoria = 0,
  className,
}: {
  categories: ChipCategory[];
  /** `null` = Todos · uuid = una categoría · `SIN_CATEGORIA` = la deuda. */
  value: string | null;
  onChange: (id: string | null) => void;
  /** md = admin (h-9) · lg = POS táctil (h-10) */
  size?: "md" | "lg";
  /** Techo de chips visibles antes de "Más". */
  maxVisible?: number;
  /** Cuántos productos hay sin categoría (0 = ni se muestra). */
  sinCategoria?: number;
  className?: string;
}) {
  const [sheet, setSheet] = useState(false);

  /* La activa SIEMPRE visible: si quedó fuera del top, se ancla segunda (después
     del primer chip del top, que es el más usado). */
  const visibles = useMemo(() => {
    const top = categories.slice(0, maxVisible);
    if (value && value !== SIN_CATEGORIA && !top.some((c) => c.id === value)) {
      const activa = categories.find((c) => c.id === value);
      if (activa) top.splice(1, top.length > 1 ? 1 : 0, activa);
    }
    return top;
  }, [categories, value, maxVisible]);

  /* Overflow FÍSICO además del cap numérico: con exactamente `maxVisible` categorías
     que no entran en el ancho, no habría "Más" y la última quedaría accesible solo
     por scroll — justo lo que este rediseño vino a matar. Si hay algo oculto, hay "Más". */
  const filaRef = useRef<HTMLDivElement>(null);
  const [desborda, setDesborda] = useState(false);
  useEffect(() => {
    const el = filaRef.current;
    if (!el) return;
    const medir = () => setDesborda(el.scrollWidth > el.clientWidth + 4);
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [visibles.length, sinCategoria]);

  const hayMas = categories.length > maxVisible || sinCategoria > 0 || desborda;

  if (categories.length === 0 && sinCategoria === 0) return null;

  const alto = size === "lg" ? "h-10" : "h-9";

  return (
    <>
      <div className={cn("flex items-center gap-1.5", className)}>
        <div
          ref={filaRef}
          role="tablist"
          aria-label="Filtrar por categoría"
          className={cn(
            "flex min-w-0 flex-1 gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            // Máscara de degradado: el borde derecho "se apaga" mientras haya más
            // contenido scrolleable — el atajo del scroll deja de ser invisible.
            "[mask-image:linear-gradient(to_right,black_calc(100%-1.5rem),transparent)]",
          )}
        >
          <Chip alto={alto} activa={value === null} onClick={() => onChange(null)}>
            Todos
          </Chip>
          {visibles.map((c) => {
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
                {typeof c.count === "number" && (
                  <span className="tabular text-xs text-muted-foreground">{c.count}</span>
                )}
              </Chip>
            );
          })}
          {/* Sin categoría inline SOLO cuando no hay sheet (todo entró al techo):
              la deuda no puede quedar inaccesible. Con sheet, vive al final de este. */}
          {sinCategoria > 0 && categories.length <= maxVisible && (
            <ChipSinCategoria
              alto={alto}
              activa={value === SIN_CATEGORIA}
              count={sinCategoria}
              onClick={() => onChange(value === SIN_CATEGORIA ? null : SIN_CATEGORIA)}
            />
          )}
        </div>

        {hayMas && (
          <button
            type="button"
            onClick={() => setSheet(true)}
            aria-haspopup="dialog"
            className={cn(
              "flex shrink-0 cursor-pointer items-center gap-1 rounded-full border border-border px-3 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground",
              alto,
            )}
          >
            Más <ChevronDown className="size-3.5" />
          </button>
        )}
      </div>

      {/* PORTAL al body: los chips viven dentro de headers con backdrop-blur, y un
          backdrop-filter convierte al ancestro en containing block del `fixed` — el
          sheet quedaba anclado al header en vez de a la pantalla (visto en el POS). */}
      {sheet &&
        createPortal(
          <SheetCategorias
            categories={categories}
            value={value}
            sinCategoria={sinCategoria}
            onPick={(id) => {
              onChange(id);
              setSheet(false);
            }}
            onClose={() => setSheet(false)}
          />,
          document.body,
        )}
    </>
  );
}

/**
 * Todas las categorías: bottom-sheet en mobile, panel centrado en desktop.
 * 2 columnas, contador por categoría, buscador propio si son >20, y
 * "Sin categoría (N)" al final como deuda visible.
 */
function SheetCategorias({
  categories,
  value,
  sinCategoria,
  onPick,
  onClose,
}: {
  categories: ChipCategory[];
  value: string | null;
  sinCategoria: number;
  onPick: (id: string | null) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");

  const filtradas = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return categories;
    return categories.filter((c) => c.name.toLowerCase().includes(t));
  }, [categories, q]);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-end bg-black/60 sm:place-items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Todas las categorías"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[70dvh] w-full overflow-y-auto rounded-t-2xl border border-border bg-popover p-4 sm:max-w-md sm:rounded-2xl"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">Categorías</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="cursor-pointer text-muted-foreground hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>

        {categories.length > 20 && (
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar categoría"
              className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm outline-none focus:border-primary"
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-1.5">
          {filtradas.map((c) => {
            const activa = value === c.id;
            const color = c.color ?? "var(--primary)";
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onPick(activa ? null : c.id)}
                className={cn(
                  "flex h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-left text-sm transition-colors",
                  activa
                    ? "border-primary/50 bg-primary/10 font-medium text-foreground"
                    : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
                )}
              >
                <span
                  aria-hidden
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className="min-w-0 flex-1 truncate">{c.name}</span>
                {typeof c.count === "number" && (
                  <span className="tabular shrink-0 text-xs text-muted-foreground">{c.count}</span>
                )}
              </button>
            );
          })}
          {filtradas.length === 0 && (
            <p className="col-span-2 px-2 py-6 text-center text-sm text-muted-foreground">
              Ninguna categoría coincide.
            </p>
          )}
        </div>

        {/* La deuda, SIEMPRE al final y con su propio tono: lo que quedó sin
            categoría es trabajo pendiente, no una categoría más. */}
        {sinCategoria > 0 && (
          <button
            type="button"
            onClick={() => onPick(value === SIN_CATEGORIA ? null : SIN_CATEGORIA)}
            className={cn(
              "mt-2 flex h-11 w-full cursor-pointer items-center gap-2 rounded-lg border px-3 text-left text-sm transition-colors",
              value === SIN_CATEGORIA
                ? "border-warning/50 bg-warning/10 font-medium text-warning-ink"
                : "border-dashed border-border text-muted-foreground hover:border-warning/40 hover:text-warning-ink",
            )}
          >
            <span className="min-w-0 flex-1 truncate">Sin categoría</span>
            <span className="tabular shrink-0 text-xs">{sinCategoria}</span>
          </button>
        )}
      </div>
    </div>
  );
}

function ChipSinCategoria({
  alto,
  activa,
  count,
  onClick,
}: {
  alto: string;
  activa: boolean;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={activa}
      onClick={onClick}
      className={cn(
        "flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-dashed px-3.5 text-sm font-medium transition-colors duration-150",
        alto,
        activa
          ? "border-warning/50 bg-warning/10 text-warning-ink"
          : "border-border text-muted-foreground hover:border-warning/40 hover:text-warning-ink",
      )}
    >
      Sin categoría
      <span className="tabular text-xs">{count}</span>
    </button>
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
