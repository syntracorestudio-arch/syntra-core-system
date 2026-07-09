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
  Bell,
  X,
} from "lucide-react";
import { markNotificationsRead } from "@/app/admin/notifications-actions";

type Item = { key: string; href: string; label: string; icon: typeof LayoutGrid; adminOnly: boolean };
export type NotifItem = { id: string; title: string; body: string | null; link: string | null; read: boolean; createdAt: string };

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
function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "recién";
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} d`;
}

function NotifList({ items, onNavigate }: { items: NotifItem[]; onNavigate?: () => void }) {
  if (items.length === 0) {
    return <p className="px-1 py-6 text-center text-sm text-muted-foreground">Sin novedades por ahora.</p>;
  }
  return (
    <ul className="divide-y divide-border">
      {items.map((n) => {
        const inner = (
          <div className="flex items-start gap-2 py-2.5">
            <span className={`mt-1.5 size-1.5 shrink-0 rounded-full ${n.read ? "bg-transparent" : "bg-primary"}`} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className={`text-sm ${n.read ? "text-foreground" : "font-semibold text-foreground"}`}>{n.title}</p>
              {n.body ? <p className="truncate text-xs text-muted-foreground">{n.body}</p> : null}
              <p className="mt-0.5 text-[11px] text-muted-foreground">{relTime(n.createdAt)}</p>
            </div>
          </div>
        );
        return (
          <li key={n.id}>
            {n.link ? (
              <Link href={n.link} onClick={onNavigate} className="-mx-2 block rounded-lg px-2 hover:bg-secondary">
                {inner}
              </Link>
            ) : (
              <div className="px-0">{inner}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function AdminSidebar({
  role,
  studioName,
  logo,
  userName,
  notifications = [],
  unreadCount = 0,
}: {
  role: string;
  studioName: string;
  logo: string | null;
  userName: string;
  notifications?: NotifItem[];
  unreadCount?: number;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const isAdmin = role === "admin";
  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));
  const canSee = (it: Item) => !it.adminOnly || isAdmin;

  const brand = logo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={logo} alt={studioName} className="h-9 w-auto max-w-[130px] object-contain" />
  ) : (
    <span className="inline-flex min-w-0 items-center gap-2">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-active text-sidebar-active-foreground">
        <CalendarCheck className="size-4" aria-hidden />
      </span>
      <span className="truncate text-sm font-bold tracking-tight text-sidebar-foreground">{studioName}</span>
    </span>
  );

  const bellBtn = (
    <button
      type="button"
      onClick={() => setNotifOpen((v) => !v)}
      aria-label="Novedades"
      className="relative flex size-9 shrink-0 items-center justify-center rounded-lg text-sidebar-muted transition-colors hover:bg-sidebar-hover hover:text-sidebar-foreground"
    >
      <Bell className="size-4" aria-hidden />
      {unreadCount > 0 ? (
        <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      ) : null}
    </button>
  );

  const userFooter = (
    <div className="flex items-center gap-2.5 border-t border-sidebar-border px-4 py-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sidebar-active text-sm font-semibold text-sidebar-active-foreground">
        {initials(userName)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-sidebar-foreground">{userName}</p>
        <p className="truncate text-xs text-sidebar-muted">{ROLE_LABEL[role] ?? "Equipo"}</p>
      </div>
      <a
        href="/logout"
        aria-label="Cerrar sesión"
        className="flex size-9 items-center justify-center rounded-lg text-sidebar-muted transition-colors hover:bg-sidebar-hover hover:text-sidebar-foreground"
      >
        <LogOut className="size-4" aria-hidden />
      </a>
    </div>
  );

  const primary = GROUPS[0].items;
  const moreItems = GROUPS.flatMap((g) => g.items).filter((it) => canSee(it) && !primary.some((p) => p.key === it.key));

  return (
    <>
      {/* ── Sidebar desktop ── */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <div className="flex h-16 items-center justify-between gap-2 px-4">
          {brand}
          {bellBtn}
        </div>

        {notifOpen ? (
          <div className="absolute left-3 top-16 z-40 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-card p-3 shadow-lg">
            <div className="mb-1 flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">Novedades</p>
              {unreadCount > 0 ? (
                <form action={markNotificationsRead}>
                  <button type="submit" className="text-xs font-medium text-primary hover:underline">
                    marcar leídas
                  </button>
                </form>
              ) : null}
            </div>
            <div className="max-h-80 overflow-y-auto">
              <NotifList items={notifications} onNavigate={() => setNotifOpen(false)} />
            </div>
          </div>
        ) : null}

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-2">
          {GROUPS.map((g) => {
            const items = g.items.filter(canSee);
            if (items.length === 0) return null;
            return (
              <div key={g.group}>
                <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-sidebar-muted/80">
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
                              ? "bg-sidebar-active font-medium text-sidebar-active-foreground"
                              : "text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-foreground"
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
          className="relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] text-muted-foreground"
        >
          <MoreHorizontal className="size-5" aria-hidden />
          Más
          {unreadCount > 0 ? (
            <span className="absolute right-6 top-1.5 size-2 rounded-full bg-primary" aria-hidden />
          ) : null}
        </button>
      </nav>

      {/* ── Sheet "Más" (mobile) ── */}
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Más opciones">
          <div className="absolute inset-0 bg-foreground/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-2xl border-t border-border bg-card p-4 pb-6 duration-300 animate-in slide-in-from-bottom-4">
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

            {/* Novedades */}
            <div className="mb-3 rounded-xl border border-border bg-surface-sunken p-3">
              <div className="flex items-center justify-between">
                <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <Bell className="size-4 text-primary" aria-hidden />
                  Novedades
                </p>
                {unreadCount > 0 ? (
                  <form action={markNotificationsRead}>
                    <button type="submit" className="text-xs font-medium text-primary hover:underline">
                      marcar leídas
                    </button>
                  </form>
                ) : null}
              </div>
              <NotifList items={notifications} onNavigate={() => setOpen(false)} />
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
