import { LogOut } from "lucide-react";

import { panelLogout } from "@/app/actions/panel-auth";
import { Button } from "@/components/ui/button";

/** Header del panel (Server Component). Logout vía Server Action. */
function PanelHeader() {
  return (
    <header className="flex items-center justify-between gap-4">
      <div className="flex flex-col">
        <span className="font-heading text-lg font-bold tracking-tight">
          SYNTRA<span className="text-brand-cyan"> CORE</span>
        </span>
        <span className="text-xs text-muted-foreground">Panel de leads</span>
      </div>
      <form action={panelLogout}>
        <Button type="submit" variant="ghost" size="sm">
          <LogOut data-icon="inline-start" />
          Salir
        </Button>
      </form>
    </header>
  );
}

export { PanelHeader };
