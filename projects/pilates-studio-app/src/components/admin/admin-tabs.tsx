import { LayoutGrid, CalendarDays, Users, BarChart3, Settings } from "lucide-react";

const TABS = [
  { key: "resumen", href: "/admin", label: "Resumen", icon: LayoutGrid, adminOnly: false },
  { key: "clases", href: "/admin/clases", label: "Clases", icon: CalendarDays, adminOnly: false },
  { key: "alumnos", href: "/admin/alumnos", label: "Alumnos", icon: Users, adminOnly: false },
  { key: "reportes", href: "/admin/reportes", label: "Reportes", icon: BarChart3, adminOnly: true },
  { key: "configuracion", href: "/admin/configuracion", label: "Ajustes", icon: Settings, adminOnly: false },
] as const;

export type AdminTabKey = "resumen" | "clases" | "alumnos" | "reportes" | "configuracion";

/**
 * Navegación del panel admin. `role` filtra pestañas sensibles:
 * Reportes (datos financieros) es solo para `admin` (reception no lo ve).
 * En mobile el label se oculta bajo 420px para que las 5 pestañas respiren.
 */
export function AdminTabs({ active, role = "admin" }: { active: AdminTabKey; role?: string }) {
  const tabs = TABS.filter((t) => !t.adminOnly || role === "admin");
  return (
    <nav className="mt-5 flex gap-1 rounded-xl bg-secondary p-1">
      {tabs.map((t) => {
        const isActive = t.key === active;
        const Icon = t.icon;
        return (
          <a
            key={t.key}
            href={t.href}
            aria-current={isActive ? "page" : undefined}
            title={t.label}
            className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-sm font-medium transition-colors sm:px-3 ${
              isActive ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            <span className="hidden min-[420px]:inline">{t.label}</span>
          </a>
        );
      })}
    </nav>
  );
}
