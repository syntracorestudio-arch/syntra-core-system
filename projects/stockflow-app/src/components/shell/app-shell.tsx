import Link from "next/link";
import {
  LayoutDashboard,
  ScanBarcode,
  Package,
  Users,
  CalendarClock,
  Settings,
  LogOut,
  ChartColumn,
  Menu,
  Wallet,
  Users2,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { signOut } from "@/app/login/actions";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

/** Navegación del dueño. El empleado ve un set recortado (tanda 1B, según permisos). */
const OWNER_NAV: NavItem[] = [
  { href: "/admin", label: "Resumen", icon: LayoutDashboard },
  { href: "/pos", label: "Vender", icon: ScanBarcode },
  { href: "/admin/caja", label: "Caja", icon: Wallet },
  { href: "/admin/reportes", label: "Reportes", icon: ChartColumn },
  { href: "/admin/precios", label: "Precios", icon: TrendingUp },
  { href: "/admin/productos", label: "Productos", icon: Package },
  { href: "/admin/fiado", label: "Fiado", icon: Users },
  { href: "/admin/vencimientos", label: "Vencimientos", icon: CalendarClock },
  { href: "/admin/equipo", label: "Equipo", icon: Users2 },
  { href: "/admin/configuracion", label: "Ajustes", icon: Settings },
];

/**
 * Shell de la app: sidebar en desktop, barra inferior en mobile.
 * Mobile-first — el dueño mira el negocio desde el teléfono.
 */
export function AppShell({
  children,
  current,
  storeName,
  userLabel,
}: {
  children: React.ReactNode;
  current: string;
  storeName: string;
  userLabel: string;
}) {
  /* En mobile la barra inferior muestra lo que se toca a diario; el resto entra
     por "Más". Sin ese botón, Reportes / Vencimientos / Ajustes serían
     INALCANZABLES desde el teléfono, que es donde el dueño usa la app. */
  const MOBILE_PRIMARY = ["/admin", "/pos", "/admin/productos"];
  const mobileNav = OWNER_NAV.filter((i) => MOBILE_PRIMARY.includes(i.href));
  const mobileRest = OWNER_NAV.filter((i) => !MOBILE_PRIMARY.includes(i.href));

  return (
    <div className="flex min-h-dvh">
      {/* Sidebar — desktop */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-card lg:flex">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <div className="grid size-8 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            SF
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{storeName}</p>
            <p className="text-xs text-muted-foreground">StockFlow</p>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 px-3 py-2">
          {OWNER_NAV.map((item) => {
            const active = item.href === current;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors duration-150",
                  active
                    ? "bg-accent font-medium text-accent-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                <item.icon className="size-[18px] shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border px-5 py-4">
          <p className="text-xs text-muted-foreground">Conectado como</p>
          <p className="truncate text-sm font-medium">{userLabel}</p>
          <form action={signOut}>
            <button
              type="submit"
              className="mt-2 flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <LogOut className="size-3.5" /> Salir
            </button>
          </form>
        </div>
      </aside>

      {/* Contenido */}
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex-1 pb-20 lg:pb-0">{children}</main>

        {/* Barra inferior — mobile */}
        <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-border bg-card/95 backdrop-blur lg:hidden">
          {mobileNav.map((item) => {
            const active = item.href === current;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 text-[11px] transition-colors duration-150",
                  active ? "text-primary-ink" : "text-muted-foreground",
                )}
              >
                <item.icon className="size-5" />
                {item.label}
              </Link>
            );
          })}

          {/* `details` nativo: menú sin JavaScript ni estado. */}
          <details className="group relative [&[open]>summary>svg]:rotate-180">
            <summary
              className={cn(
                "flex cursor-pointer list-none flex-col items-center gap-1 py-2.5 text-[11px] transition-colors duration-150 [&::-webkit-details-marker]:hidden",
                mobileRest.some((i) => i.href === current)
                  ? "text-primary-ink"
                  : "text-muted-foreground",
              )}
            >
              <Menu className="size-5 transition-transform" />
              Más
            </summary>
            <div className="absolute bottom-full right-0 mb-1 min-w-44 overflow-hidden rounded-xl border border-border bg-popover shadow-xl">
              {mobileRest.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={item.href === current ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2.5 px-4 py-3 text-sm transition-colors",
                    item.href === current
                      ? "bg-accent text-accent-foreground"
                      : "text-foreground hover:bg-secondary",
                  )}
                >
                  <item.icon className="size-4 shrink-0" />
                  {item.label}
                </Link>
              ))}
              <form action={signOut} className="border-t border-border">
                <button
                  type="submit"
                  className="flex w-full cursor-pointer items-center gap-2.5 px-4 py-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  <LogOut className="size-4 shrink-0" /> Salir
                </button>
              </form>
            </div>
          </details>
        </nav>
      </div>
    </div>
  );
}
