import Link from "next/link";
import {
  LayoutDashboard,
  ScanBarcode,
  Package,
  PackagePlus,
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
import { LogoMark, Wordmark } from "@/components/brand/logo";
import { signOut } from "@/app/login/actions";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

type NavGroup = { label: string; items: NavItem[] };

/**
 * Navegación del dueño, agrupada por el modelo mental del kiosquero:
 * lo que toca todos los días · el flujo físico de mercadería · la plata ·
 * el setup que casi no toca. (El empleado ve un set recortado por permisos.)
 */
const NAV_GROUPS: NavGroup[] = [
  {
    label: "Operación",
    items: [
      { href: "/admin", label: "Resumen", icon: LayoutDashboard },
      { href: "/pos", label: "Vender", icon: ScanBarcode },
      { href: "/admin/caja", label: "Caja", icon: Wallet },
    ],
  },
  {
    label: "Mercadería",
    items: [
      { href: "/admin/productos", label: "Productos", icon: Package },
      /* Antes esta página ni figuraba en la nav — era inalcanzable sin URL
         directa. "Recibir mercadería" y no "Ingreso": ingreso solo, al lado de
         Caja y Fiado, se lee como plata que entra. */
      { href: "/admin/ingreso", label: "Recibir mercadería", icon: PackagePlus },
      { href: "/admin/precios", label: "Precios", icon: TrendingUp },
      { href: "/admin/vencimientos", label: "Vencimientos", icon: CalendarClock },
    ],
  },
  {
    /* "Control" y no "Plata" (pedido del owner 2026-07-22): agrupa lo que se
       mira para controlar el negocio — a quién cobrar y cómo viene. */
    label: "Control",
    items: [
      { href: "/admin/fiado", label: "Fiado", icon: Users },
      { href: "/admin/reportes", label: "Reportes", icon: ChartColumn },
    ],
  },
  {
    label: "Negocio",
    items: [
      { href: "/admin/equipo", label: "Equipo", icon: Users2 },
      { href: "/admin/configuracion", label: "Ajustes", icon: Settings },
    ],
  },
];

const ALL_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

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
  /* La barra inferior lleva el loop diario (abrir caja → vender → mirar el
     resumen); todo lo demás entra por "Más". Productos NO va en la barra: es
     tarea de edición, no de mostrador. */
  const MOBILE_PRIMARY = ["/admin", "/pos", "/admin/caja"];
  const mobileNav = ALL_ITEMS.filter((i) => MOBILE_PRIMARY.includes(i.href));
  const mobileRestGroups = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => !MOBILE_PRIMARY.includes(i.href)),
  })).filter((g) => g.items.length > 0);
  const mobileRest = mobileRestGroups.flatMap((g) => g.items);

  return (
    <div className="flex min-h-dvh">
      {/* Sidebar — desktop */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-card lg:flex">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <LogoMark className="size-8" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{storeName}</p>
            <Wordmark className="text-xs text-muted-foreground" />
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-2">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="px-3 pb-1 pt-4 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
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
                          ? "bg-accent font-medium text-accent-foreground"
                          : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                      )}
                    >
                      <item.icon className="size-[18px] shrink-0" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
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
                {/* Pill activa: color solo no alcanza como affordance en la barra */}
                <span
                  className={cn(
                    "grid h-6 w-12 place-items-center rounded-full transition-colors duration-150",
                    active && "bg-accent",
                  )}
                >
                  <item.icon className="size-5" />
                </span>
                {item.label}
              </Link>
            );
          })}

          {/* `details` nativo: menú sin JavaScript ni estado. */}
          <details className="group relative [&[open]>summary>span>svg]:rotate-180">
            <summary
              className={cn(
                "flex cursor-pointer list-none flex-col items-center gap-1 py-2.5 text-[11px] transition-colors duration-150 [&::-webkit-details-marker]:hidden",
                mobileRest.some((i) => i.href === current)
                  ? "text-primary-ink"
                  : "text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "grid h-6 w-12 place-items-center rounded-full transition-colors duration-150",
                  mobileRest.some((i) => i.href === current) && "bg-accent",
                )}
              >
                <Menu className="size-5 transition-transform" />
              </span>
              Más
            </summary>
            <div className="absolute bottom-full right-2 mb-2 min-w-52 overflow-hidden rounded-xl border border-border bg-popover shadow-xl">
              {mobileRestGroups.map((group, gi) => (
                <div key={group.label} className={cn(gi > 0 && "border-t border-border")}>
                  {group.items.map((item) => (
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
                </div>
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
