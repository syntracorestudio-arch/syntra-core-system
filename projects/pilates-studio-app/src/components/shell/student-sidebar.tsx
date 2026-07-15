"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  CalendarCheck,
  Wallet,
  LogOut,
  MoreHorizontal,
  Bell,
  X,
  UserRound,
  LayoutGrid,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import { markMyNotificationsRead } from "@/app/app/actions";

type Item = { key: string; href: string; label: string; icon: typeof CalendarDays };
export type StudentNotif = { id: string; title: string; body: string | null; link: string | null; read: boolean; createdAt: string };

/** Saldo para el widget del pie (calculado server-side en el layout). */
export type SaldoWidget = {
  text: string;
  /** hint de vencimiento / última clase (null si no aplica) */
  hint: string | null;
  /** true → el hint va en warning (última clase / vence pronto / sin créditos) */
  warn: boolean;
};

const ITEMS: Item[] = [
  { key: "reservar", href: "/app", label: "Reservar", icon: CalendarDays },
  { key: "actividad", href: "/app/actividad", label: "Mi actividad", icon: CalendarCheck },
  { key: "saldo", href: "/app/comprar", label: "Mi saldo", icon: Wallet },
];

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

function NotifList({ items, onNavigate }: { items: StudentNotif[]; onNavigate?: () => void }) {
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
              {n.body ? <p className="line-clamp-2 text-xs text-muted-foreground">{n.body}</p> : null}
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

/**
 * Shell de navegación del ALUMNO — misma firma visual que el panel (carbón + píldora
 * de acento white-label + glow) pero con el job del consumidor: reservar, su actividad
 * y su saldo. Desktop: sidebar fija. Mobile: bottom-bar + sheet "Más".
 */
export function StudentSidebar({
  studioName,
  logo,
  userName,
  saldo,
  isStaff = false,
  notifications = [],
  unreadCount = 0,
}: {
  studioName: string;
  logo: string | null;
  userName: string;
  saldo: SaldoWidget;
  isStaff?: boolean;
  notifications?: StudentNotif[];
  unreadCount?: number;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const isActive = (href: string) => (href === "/app" ? pathname === "/app" : pathname.startsWith(href));

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

  const markReadBtn =
    unreadCount > 0 ? (
      <form action={markMyNotificationsRead}>
        <button type="submit" className="text-xs font-medium text-primary hover:underline">
          marcar leídas
        </button>
      </form>
    ) : null;

  return (
    <>
      {/* ── Sidebar desktop ── */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-28"
          style={{ background: "radial-gradient(18rem 7rem at 20% 0%, color-mix(in srgb, var(--primary) 22%, transparent), transparent 70%)" }}
        />
        <div className="flex h-16 items-center justify-between gap-2 px-4">
          {brand}
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
        </div>

        {notifOpen ? (
          <div className="absolute left-3 top-16 z-40 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-card p-3 shadow-lg">
            <div className="mb-1 flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">Novedades</p>
              {markReadBtn}
            </div>
            <div className="max-h-80 overflow-y-auto">
              <NotifList items={notifications} onNavigate={() => setNotifOpen(false)} />
            </div>
          </div>
        ) : null}

        <nav className="flex-1 overflow-y-auto px-3 py-2">
          <ul className="space-y-0.5">
            {ITEMS.map((it) => {
              const Icon = it.icon;
              const active = isActive(it.href);
              return (
                <li key={it.key}>
                  <Link
                    href={it.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-base ${
                      active
                        ? "bg-primary font-semibold text-primary-foreground"
                        : "text-sidebar-muted hover:translate-x-0.5 hover:bg-sidebar-hover hover:text-sidebar-foreground"
                    }`}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden />
                    {it.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* ── Tu saldo: el dato que el alumno siempre quiere a mano ── */}
        <div className="border-t border-sidebar-border px-3 py-3">
          <div className="rounded-xl bg-sidebar-hover p-3">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-sidebar-muted">
              <Sparkles className="size-3" aria-hidden />
              Tu saldo
            </p>
            <p className="mt-0.5 truncate text-sm font-semibold text-sidebar-foreground">{saldo.text}</p>
            {saldo.hint ? (
              <p className={`mt-0.5 flex items-center gap-1 text-[11px] ${saldo.warn ? "text-warning" : "text-sidebar-muted"}`}>
                {saldo.warn ? <AlertCircle className="size-3 shrink-0" aria-hidden /> : null}
                {saldo.hint}
              </p>
            ) : null}
            <Link
              href="/app/comprar"
              className="mt-2 flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:opacity-90"
            >
              <Wallet className="size-3.5" aria-hidden />
              Comprar
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-1 border-t border-sidebar-border px-3 py-3">
          <Link
            href="/cuenta"
            title="Mi cuenta"
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-1.5 py-1 transition-colors hover:bg-sidebar-hover"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sidebar-active text-sm font-semibold text-sidebar-active-foreground">
              {initials(userName)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-sidebar-foreground">{userName}</span>
              <span className="block truncate text-xs text-sidebar-muted">Alumno</span>
            </span>
          </Link>
          {isStaff ? (
            <Link
              href="/admin"
              aria-label="Ir al panel"
              title="Ir al panel"
              className="flex size-9 shrink-0 items-center justify-center rounded-lg text-sidebar-muted transition-colors hover:bg-sidebar-hover hover:text-sidebar-foreground"
            >
              <LayoutGrid className="size-4" aria-hidden />
            </Link>
          ) : null}
          <a
            href="/logout"
            aria-label="Cerrar sesión"
            className="flex size-9 shrink-0 items-center justify-center rounded-lg text-sidebar-muted transition-colors hover:bg-sidebar-hover hover:text-sidebar-foreground"
          >
            <LogOut className="size-4" aria-hidden />
          </a>
        </div>
      </aside>

      {/* ── Bottom bar mobile ── */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-card/95 backdrop-blur lg:hidden">
        {ITEMS.map((it) => {
          const Icon = it.icon;
          const active = isActive(it.href);
          return (
            <Link
              key={it.key}
              href={it.href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] ${
                active ? "font-semibold text-primary" : "text-muted-foreground"
              }`}
            >
              <span
                className={`flex h-6 w-10 items-center justify-center rounded-full transition-base ${
                  active ? "bg-primary text-primary-foreground shadow-sm" : ""
                }`}
              >
                <Icon className="size-5" aria-hidden />
              </span>
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
          {unreadCount > 0 ? <span className="absolute right-6 top-1.5 size-2 rounded-full bg-primary" aria-hidden /> : null}
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

            <div className="mb-3 rounded-xl border border-border bg-surface-sunken p-3">
              <div className="flex items-center justify-between">
                <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <Bell className="size-4 text-primary" aria-hidden />
                  Novedades
                </p>
                {markReadBtn}
              </div>
              <NotifList items={notifications} onNavigate={() => setOpen(false)} />
            </div>

            <ul className="grid gap-1">
              <li>
                <Link
                  href="/cuenta"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-foreground hover:bg-secondary"
                >
                  <UserRound className="size-5 text-muted-foreground" aria-hidden />
                  Mi cuenta
                </Link>
              </li>
              {isStaff ? (
                <li>
                  <Link
                    href="/admin"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-foreground hover:bg-secondary"
                  >
                    <LayoutGrid className="size-5 text-muted-foreground" aria-hidden />
                    Ir al panel
                  </Link>
                </li>
              ) : null}
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
