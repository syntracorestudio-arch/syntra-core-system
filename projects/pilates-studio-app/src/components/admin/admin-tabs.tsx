import { CalendarDays, Users } from "lucide-react";

const TABS = [
  { href: "/admin/clases", label: "Clases", icon: CalendarDays },
  { href: "/admin/alumnos", label: "Alumnos", icon: Users },
];

/** Navegación del panel admin. `active` = "clases" | "alumnos". */
export function AdminTabs({ active }: { active: "clases" | "alumnos" }) {
  return (
    <nav className="mt-5 flex gap-1 rounded-xl bg-secondary p-1">
      {TABS.map((t) => {
        const isActive = t.href.endsWith(active);
        const Icon = t.icon;
        return (
          <a
            key={t.href}
            href={t.href}
            aria-current={isActive ? "page" : undefined}
            className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
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
