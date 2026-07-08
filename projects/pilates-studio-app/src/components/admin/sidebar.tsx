"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  CalendarDays,
  Users,
  Ticket,
  BarChart3,
  Settings,
  LogOut,
  MoreHorizontal,
  CalendarCheck,
  X,
} from "lucide-react";

type Item = { key: string; href: string; label: string; icon: typeof LayoutGrid; adminOnly: boolean };

const GROUPS: { group: string; items: Item[] }[] = [
  {
    group: "Principal",
    items: [
      { key: "resumen", href: "/admin", label: "Resumen", icon: LayoutGrid, adminOnly: false },
      { key: "clases", href: "/admin/clases", label: "Clases", icon: CalendarDays, adminOnly: false },
      { key: "alumnos", href: "/admin/alumnos", label: "Alumnos", icon: Users, adminOnly: false },
    ],
  },
  {
    group: "Gestión",
    items: [
      { key: "packs", href: "/admin/packs", label: "Packs", icon: Ticket, adminOnly: true },
      { key: "reportes", href: "/admin/reportes", label: "Reportes", icon: BarChart3, adminOnly: true },
      { key: "configuracion", href: "/admin/configuracion", label: "Ajustes", icon: Settings, adminOnly: true },
    ],
  },
];

const ROLE_LABEL: Record<string, string> = { admin: "Administrador", reception: "Recepción" };

function initials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "·";
}

export function AdminSidebar({
  role,
  studioName,
  logo,
  userName,
}: {
  role: string;
  studioName: string;
  logo: string | null;
  userName: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isAdmin = role === "admin";
  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));
  const canSee = (it: Item) => !it.adminOnly || isAdmin;

  const brand = logo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={logo} alt={studioName} className="h-9 w-auto max-w-[150px] object-contain" />
  ) : (
    <span className="inline-flex items-center gap-2">
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <CalendarCheck className="size-4" aria-hidden />
      </span>
      <span className="truncate text-sm font-bold tracking-tight text-foreground">{studioName}</span>
    </span>
  );

  const userFooter = (
    <div className="flex items-center gap-2.5 border-t border-border px-4 py-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-primary">
        {initials(userName)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{userName}</p>
        <p className="truncate text-xs text-muted-foreground">{ROLE_LABEL[role] ?? "Equipo"}</p>
      </div>
      <a
        href="/logout"
        aria-label="Cerrar sesión"
        className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <LogOut className="size-4" aria-hidden />
      </a>
    </div>
  );

  // items de la bottom-bar (mobile): 3 esenciales + "Más"
  const primary = GROUPS[0].items;
  const moreItems = GROUPS.flatMap((g) => g.items).filter((it) => canSee(it) && !primary.some((p) => p.key === it.key));

  return (
    <>
      {/* ── Sidebar desktop ── */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-surface-sunken lg:flex">
        <div className="flex h-16 items-center px-4">{brand}</div>
        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-2">
          {GROUPS.map((g) => {
            const items = g.items.filter(canSee);
            if (items.length === 0) return null;
            return (
              <div key={g.group}>
                <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">
                  {g.group}
                </p>
                <ul className="space-y-0.5">
                  {items.map((it) => {
                    const Icon = it.icon;
                    const active = isActive(it.href);
                    return (
                      <li key={it.key}>
                        <Link
                          href={it.href}
                          aria-current={active ? "page" : undefined}
                          className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                            active
                              ? "bg-primary/10 font-medium text-primary"
                              : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                          }`}
                        >
                          <Icon className="size-4 shrink-0" aria-hidden />
                          {it.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>
        {userFooter}
      </aside>

      {/* ── Bottom bar mobile ── */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-card/95 backdrop-blur lg:hidden">
        {primary.map((it) => {
          const Icon = it.icon;
          const active = isActive(it.href);
          return (
            <Link
              key={it.key}
              href={it.href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Icon className="size-5" aria-hidden />
              {it.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] text-muted-foreground"
        >
          <MoreHorizontal className="size-5" aria-hidden />
          Más
        </button>
      </nav>

      {/* ── Sheet "Más" (mobile) ── */}
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Más opciones">
          <div className="absolute inset-0 bg-foreground/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-border bg-card p-4 pb-6 duration-300 animate-in slide-in-from-bottom-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">Más</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
                className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
            <ul className="grid gap-1">
              {moreItems.map((it) => {
                const Icon = it.icon;
                const active = isActive(it.href);
                return (
                  <li key={it.key}>
                    <Link
                      href={it.href}
                      onClick={() => setOpen(false)}
                      className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm ${
                        active ? "bg-primary/10 font-medium text-primary" : "text-foreground hover:bg-secondary"
                      }`}
                    >
                      <Icon className="size-5 text-muted-foreground" aria-hidden />
                      {it.label}
                    </Link>
                  </li>
                );
              })}
              <li>
                <a
                  href="/logout"
                  className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-foreground hover:bg-secondary"
                >
                  <LogOut className="size-5 text-muted-foreground" aria-hidden />
                  Cerrar sesión
                </a>
              </li>
            </ul>
          </div>
        </div>
      ) : null}
    </>
  );
}
