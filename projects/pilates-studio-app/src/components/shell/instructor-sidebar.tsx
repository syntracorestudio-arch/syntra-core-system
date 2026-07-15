"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sun,
  BarChart3,
  History,
  LogOut,
  MoreHorizontal,
  X,
  UserRound,
  CalendarCheck,
  AlertCircle,
  ChevronRight,
} from "lucide-react";

type Item = { key: string; href: string; label: string; icon: typeof Sun };

/** Pulso del instructor para el widget del pie (server-side, en el layout). */
export type InstructorPulse = {
  /** próxima clase propia (null si no hay) */
  next: { time: string; day: string; name: string; booked: number; capacity: number } | null;
  /** clases pasadas con alumnos sin marcar (si no se cierran, el estudio pierde el dato) */
  pendientes: number;
};

const ITEMS: Item[] = [
  { key: "hoy", href: "/instructor", label: "Mis clases", icon: Sun },
  { key: "mes", href: "/instructor/mes", label: "Mi mes", icon: BarChart3 },
  { key: "historial", href: "/instructor/historial", label: "Clases dadas", icon: History },
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "·";
}

/**
 * Shell de navegación del INSTRUCTOR — misma firma visual que el panel (carbón +
 * píldora de acento white-label + glow). Desktop: sidebar fija con el pulso de su
 * agenda al pie. Mobile: bottom-bar + sheet "Más".
 */
export function InstructorSidebar({
  studioName,
  logo,
  userName,
  pulse,
}: {
  studioName: string;
  logo: string | null;
  userName: string;
  pulse: InstructorPulse | null;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => (href === "/instructor" ? pathname === "/instructor" : pathname.startsWith(href));

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

  return (
    <>
      {/* ── Sidebar desktop ── */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-28"
          style={{ background: "radial-gradient(18rem 7rem at 20% 0%, color-mix(in srgb, var(--primary) 22%, transparent), transparent 70%)" }}
        />
        <div className="flex h-16 items-center px-4">{brand}</div>

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
                    {it.key === "hoy" && pulse && pulse.pendientes > 0 ? (
                      <span className="ml-auto flex min-w-4 items-center justify-center rounded-full bg-warning px-1 text-[10px] font-bold text-foreground">
                        {pulse.pendientes}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* ── Tu agenda: próxima clase + clases sin cerrar ── */}
        {pulse ? (
          <div className="border-t border-sidebar-border px-3 py-3">
            {pulse.next ? (
              <Link href="/instructor" className="block rounded-xl bg-sidebar-hover p-3 transition-colors hover:bg-sidebar-active">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-sidebar-muted">
                  Próxima · {pulse.next.day} {pulse.next.time}
                </p>
                <p className="mt-0.5 truncate text-sm font-semibold text-sidebar-foreground">{pulse.next.name}</p>
                <span className="mt-1 flex items-center justify-between text-[11px] text-sidebar-muted">
                  <span>
                    {pulse.next.booked}/{pulse.next.capacity} anotados
                  </span>
                  <span className="inline-flex items-center gap-0.5">
                    ver <ChevronRight className="size-3" aria-hidden />
                  </span>
                </span>
              </Link>
            ) : (
              <p className="rounded-xl bg-sidebar-hover p-3 text-xs text-sidebar-muted">Sin clases próximas asignadas.</p>
            )}
            {pulse.pendientes > 0 ? (
              <Link
                href="/instructor"
                className="mt-2 flex items-center gap-1.5 px-1 text-[11px] font-medium text-warning transition-colors hover:text-sidebar-foreground"
              >
                <AlertCircle className="size-3" aria-hidden />
                {pulse.pendientes === 1 ? "1 clase sin asistencia cargada" : `${pulse.pendientes} clases sin asistencia cargada`}
              </Link>
            ) : null}
          </div>
        ) : null}

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
              <span className="block truncate text-xs text-sidebar-muted">Instructor</span>
            </span>
          </Link>
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
              className={`relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] ${
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
              {it.key === "hoy" && pulse && pulse.pendientes > 0 ? (
                <span className="absolute right-5 top-1 size-2 rounded-full bg-warning" aria-hidden />
              ) : null}
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
