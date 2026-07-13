import { LogOut, Building2, UserRound } from "lucide-react";
import { requireSuperadmin } from "@/lib/superadmin";

export const metadata = { title: "Superadmin — StudioFlow" };
export const dynamic = "force-dynamic";

/** Shell del panel SYNTRA (no white-label): top bar carbón + contenido. */
export default async function SuperLayout({ children }: { children: React.ReactNode }) {
  const { fullName } = await requireSuperadmin();

  return (
    <div className="min-h-dvh">
      <header className="border-b border-sidebar-border bg-sidebar">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-3 px-5 lg:px-8">
          <p className="inline-flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-sidebar-active text-sidebar-active-foreground">
              <Building2 className="size-4" aria-hidden />
            </span>
            <span className="text-sm font-bold tracking-tight text-sidebar-foreground">
              StudioFlow <span className="font-normal text-sidebar-muted">· Superadmin SYNTRA</span>
            </span>
          </p>
          <div className="flex items-center gap-1.5">
            {fullName ? <span className="mr-1.5 hidden text-xs text-sidebar-muted sm:block">{fullName}</span> : null}
            <a
              href="/cuenta"
              aria-label="Mi cuenta"
              title="Mi cuenta"
              className="flex size-8 items-center justify-center rounded-lg text-sidebar-muted transition-colors hover:bg-sidebar-hover hover:text-sidebar-foreground"
            >
              <UserRound className="size-4" aria-hidden />
            </a>
            <a
              href="/logout"
              aria-label="Cerrar sesión"
              className="flex size-8 items-center justify-center rounded-lg text-sidebar-muted transition-colors hover:bg-sidebar-hover hover:text-sidebar-foreground"
            >
              <LogOut className="size-4" aria-hidden />
            </a>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
