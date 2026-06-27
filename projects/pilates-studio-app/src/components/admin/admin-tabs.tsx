import { LayoutGrid, CalendarDays, Users, Settings } from "lucide-react";

const TABS = [
  { key: "resumen", href: "/admin", label: "Resumen", icon: LayoutGrid },
  { key: "clases", href: "/admin/clases", label: "Clases", icon: CalendarDays },
  { key: "alumnos", href: "/admin/alumnos", label: "Alumnos", icon: Users },
  { key: "configuracion", href: "/admin/configuracion", label: "Ajustes", icon: Settings },
] as const;

/** Navegación del panel admin. `active` = "resumen" | "clases" | "alumnos" | "configuracion". */
export function AdminTabs({ active }: { active: "resumen" | "clases" | "alumnos" | "configuracion" }) {
  return (
    <nav className="mt-5 flex gap-1 rounded-xl bg-secondary p-1">
      {TABS.map((t) => {
        const isActive = t.key === active;
        const Icon = t.icon;
        return (
          <a
            key={t.key}
            href={t.href}
            aria-current={isActive ? "page" : undefined}
            className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="size-4" aria-hidden />
            {t.label}
          </a>
        );
      })}
    </nav>
  );
}
