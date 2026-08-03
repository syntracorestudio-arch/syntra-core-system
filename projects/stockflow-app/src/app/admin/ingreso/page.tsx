import { AppShell } from "@/components/shell/app-shell";
import { requireSession } from "@/lib/session";
import { createSupabaseServer } from "@/lib/supabase/server";
import { IngresoClient } from "./ingreso-client";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function IngresoPage() {
  const session = await requireSession();
  if (!(session.member.role === "owner" || session.member.can_receive_stock)) {
    redirect("/pos");
  }

  /* ESCALA F3 — search-first. Antes esta pantalla precargaba 500 productos +
     2000 códigos + 3000 asientos de ledger EN CADA REQUEST, y resolvía el
     escaneo contra ese mapa truncado: con 2000 SKUs, ~75% del catálogo no se
     podía recibir y un código que existía podía "no existir" según qué filas
     hubiera devuelto Postgres. Ahora no viaja catálogo: cada línea se resuelve
     contra `ingreso_buscar` (migración 040), acotada y con el gate de miembro.

     Lo único que sigue viniendo del server es el total de activos, para poder
     decir la verdad en el encabezado. */
  const supabase = await createSupabaseServer();
  const { count: totalProductos } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("store_id", session.store.id)
    .eq("status", "active");

  return (
    <AppShell
      current="/admin/ingreso"
      storeName={session.store.name}
      userLabel={`${session.member.display_name ?? "Vos"} · ${
        session.member.role === "owner" ? "Dueño" : "Empleado"
      }`}
    >
      <IngresoClient totalProductos={totalProductos ?? 0} />
    </AppShell>
  );
}
