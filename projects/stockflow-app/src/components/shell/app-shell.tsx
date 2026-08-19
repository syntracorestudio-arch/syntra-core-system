import Link from "next/link";
import { LogOut, Menu, UserCog } from "lucide-react";
import { cn } from "@/lib/cn";
import { LogoMark, Wordmark } from "@/components/brand/logo";
import { signOut } from "@/app/login/actions";
import { NAV_GROUPS, ALL_ITEMS } from "./nav-data";
import { AvisoSuscripcion } from "./aviso-suscripcion";
import { SidebarNav } from "./sidebar-nav";
import { getSession } from "@/lib/session";

/**
 * Qué secciones puede ABRIR realmente esta persona.
 *
 * Hasta acá el nav no filtraba nada: el empleado veía las 14 secciones y casi
 * todas lo rebotaban a /pos en silencio. Peor todavía, eso hacía INVISIBLES los
 * permisos — el dueño le habilitaba "cargar mercadería" y del lado del empleado
 * la app se veía idéntica, porque el ítem ya estaba (y antes lo rebotaba).
 *
 * La lista sale de las guardas REALES de cada página, no de una convención: si
 * mañana una pantalla cambia de `requireOwner` a `requireSession`, hay que
 * tocar esto también. Por eso está en un solo lugar y con el motivo escrito.
 */
function puedeAbrir(
  href: string,
  m: {
    role: string;
    can_receive_stock: boolean;
    can_close_register: boolean;
    can_see_reports: boolean;
  },
): boolean {
  if (m.role === "owner") return true;
  // `requireSession` puro: cualquier miembro activo entra.
  if (href === "/pos" || href === "/admin/vencimientos") return true;
  // `requireSession` + flag (ingreso/page.tsx chequea can_receive_stock).
  if (href === "/admin/ingreso") return m.can_receive_stock;
  /* 052 · las dos pantallas que se PARTEN por permiso. No abren la sección
     entera: `cierre_caja` y la página de reportes le sirven al empleado un
     payload distinto, sin recaudación ni ganancia. Sin estas dos líneas el
     permiso queda invisible — que es exactamente el bug que esta función vino
     a arreglar, repetido un nivel más abajo. */
  if (href === "/admin/caja") return m.can_close_register;
  if (href === "/admin/reportes") return m.can_see_reports;
  // Todo el resto de /admin es `requireOwner`.
  return false;
}

/* 052 · Las dos rutas que sirven OTRA pantalla según el permiso. El empleado
   entra al mismo href que el dueño pero recibe un payload recortado, así que
   su barra tiene que nombrar lo que él va a ver, no lo que ve el dueño.
   Sólo se aplica al staff: `AppShell` no las pasa cuando el rol es owner. */
const ETIQUETAS_STAFF: Record<string, string> = {
  "/admin/caja": "Cerrar turno",
  "/admin/reportes": "Qué se vende",
};

/**
 * Shell de la app: sidebar en desktop, barra inferior en mobile.
 * Mobile-first — el dueño mira el negocio desde el teléfono.
 */
export async function AppShell({
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
  /* Server component: la sesión se lee acá y no baja por prop, así ninguna de
     las ~15 páginas que usan el shell tiene que acordarse de pasarla. */
  const session = await getSession();
  const visible = (href: string) =>
    !session || puedeAbrir(href, session.member);

  const GRUPOS = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => visible(i.href)),
  })).filter((g) => g.items.length > 0);
  const ITEMS = ALL_ITEMS.filter((i) => visible(i.href));
  // Sólo el staff renombra: el dueño ve "Caja" y "Reportes", que es lo suyo.
  const ETIQUETAS = session?.member.role === "owner" ? undefined : ETIQUETAS_STAFF;
  /* La barra inferior lleva el loop diario (abrir caja → vender → mirar el
     resumen); todo lo demás entra por "Más". Productos NO va en la barra: es
     tarea de edición, no de mostrador. */
  const MOBILE_PRIMARY = ["/admin", "/pos", "/admin/caja"];
  /* El rename vale también acá: la barra inferior es lo ÚNICO que el empleado
     ve en el teléfono, que es donde de verdad trabaja. */
  const renombrar = <T extends { href: string; label: string }>(items: T[]) =>
    ETIQUETAS ? items.map((i) => ({ ...i, label: ETIQUETAS[i.href] ?? i.label })) : items;
  const mobileNav = renombrar(ITEMS.filter((i) => MOBILE_PRIMARY.includes(i.href)));
  const mobileRestGroups = GRUPOS.map((g) => ({
    ...g,
    items: g.items.filter((i) => !MOBILE_PRIMARY.includes(i.href)),
  })).filter((g) => g.items.length > 0);
  const mobileRest = renombrar(mobileRestGroups.flatMap((g) => g.items));

  return (
    <div className="flex min-h-dvh">
      {/* Sidebar — desktop. Sticky con scroll propio: en las páginas largas
          (Ajustes, Reportes) antes se iba con el scroll y dejaba un hueco. */}
      {/* `print:hidden` en las dos navegaciones y en el colchón inferior: la
          única pantalla imprimible de la app son los carteles de góndola, y una
          sidebar impresa se lleva media hoja de tinta. */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-card lg:sticky lg:top-0 lg:flex lg:h-dvh print:hidden">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <LogoMark className="size-8" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{storeName}</p>
            <Wordmark className="text-xs text-muted-foreground" />
          </div>
        </div>

        <SidebarNav current={current} permitidos={ITEMS.map((i) => i.href)} etiquetas={ETIQUETAS} />

        <div className="border-t border-border px-5 py-4">
          <p className="text-xs text-muted-foreground">Conectado como</p>
          <p className="truncate text-sm font-medium">{userLabel}</p>
          {/* Entrada a la propia cuenta. Va acá, pegada a la identidad, y no en
              el nav: no es una sección del negocio, es del que está mirando. */}
          <div className="mt-2 flex items-center gap-3">
            <Link
              href="/cuenta"
              className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <UserCog className="size-3.5" /> Mi cuenta
            </Link>
            <form action={signOut}>
              <button
                type="submit"
                className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                <LogOut className="size-3.5" /> Salir
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Contenido */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* 063 · el aviso de suscripción impaga, ARRIBA DE TODO y en el shell:
            el push es efímero y el dueño puede pasar el día en la caja. Un
            aviso que sólo vive en una pantalla que no visita no avisa nada.
            Se renderiza solo (devuelve null si está al día) y sólo lo ve el
            dueño — para un empleado la RPC responde `no_corresponde`. */}
        <AvisoSuscripcion />

        {/* El colchón de abajo reserva la barra de pestañas MÁS la barra gestual
            de Android: sin el `env()`, los últimos ~20px del contenido quedaban
            debajo del pill del sistema. */}
        <main className="flex-1 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-0 print:pb-0">
          {children}
        </main>

        {/* Barra inferior — mobile */}
        <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden print:hidden">
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
