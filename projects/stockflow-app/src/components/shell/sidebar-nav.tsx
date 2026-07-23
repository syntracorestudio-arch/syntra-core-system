"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { NAV_GROUPS } from "./nav-data";

/**
 * Navegación de la sidebar (auditoría UI-UX 2026-07-23, parte A):
 *
 * - Identidad por grupo: tick de color + label que se tinta SOLO cuando el
 *   grupo contiene la ruta activa. El color es identidad de zona, no carnaval:
 *   los ítems siguen neutros.
 * - Estado activo con presencia: rail de 3px en `--primary` que se DESLIZA
 *   entre ítems (medido con refs + transición CSS — sin framer-motion, que no
 *   está en las deps), sobre un gradiente sutil también derivado de
 *   `--primary` → white-label safe: si el negocio pisa el acento, todo esto
 *   lo sigue.
 *
 * Variante "Color" aprobada por el owner en vivo (2026-07-23) con ajustes:
 * Control terracota (rosa rechazado) y Negocio acero azulado (el gris leía
 * blanco).
 */
export function SidebarNav({ current }: { current: string }) {
  const navRef = useRef<HTMLElement>(null);
  const [rail, setRail] = useState<{ top: number; visible: boolean }>({
    top: 0,
    visible: false,
  });

  // El rail se posiciona midiendo el <a> activo dentro del nav. Re-mide en
  // resize (los grupos no cambian de alto en runtime por otra causa).
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const measure = () => {
      const active = nav.querySelector<HTMLAnchorElement>('a[aria-current="page"]');
      if (!active) {
        setRail((r) => ({ ...r, visible: false }));
        return;
      }
      const navBox = nav.getBoundingClientRect();
      const box = active.getBoundingClientRect();
      setRail({ top: box.top - navBox.top + nav.scrollTop + box.height / 2, visible: true });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(nav);
    return () => ro.disconnect();
  }, [current]);

  return (
    <nav ref={navRef} className="relative flex-1 overflow-y-auto px-3 pb-2">
      {/* Rail activo: se desliza entre ítems con transición de top. */}
      <span
        aria-hidden
        className="absolute left-1.5 h-5 w-[3px] -translate-y-1/2 rounded-full bg-primary transition-[top] duration-200 ease-out"
        style={{ top: rail.top, opacity: rail.visible ? 1 : 0 }}
      />

      {NAV_GROUPS.map((group) => {
        const groupActive = group.items.some((i) => i.href === current);
        return (
          <div key={group.label}>
            <p
              className="flex items-center gap-2 px-3 pb-1 pt-4 text-[11px] font-medium uppercase tracking-wider transition-colors duration-200"
              style={{ color: groupActive ? group.hue : "var(--muted-foreground)" }}
            >
              <span
                aria-hidden
                className="h-[3px] w-2 rounded-full"
                style={{ background: group.hue }}
              />
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = item.href === current;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors duration-150",
                      active
                        ? "font-medium text-foreground"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                    )}
                    style={
                      active
                        ? {
                            background:
                              "linear-gradient(90deg, color-mix(in srgb, var(--primary) 16%, transparent), color-mix(in srgb, var(--primary) 4%, transparent) 70%, transparent)",
                          }
                        : undefined
                    }
                  >
                    <item.icon
                      className={cn(
                        "size-[18px] shrink-0",
                        active && "text-primary-ink",
                      )}
                    />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}

    </nav>
  );
}
