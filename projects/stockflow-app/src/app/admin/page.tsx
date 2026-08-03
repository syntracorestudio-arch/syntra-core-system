import { AppShell } from "@/components/shell/app-shell";
import { requireOwner } from "@/lib/session";
import { createSupabaseServer } from "@/lib/supabase/server";
import { DashboardClient, type DashboardData } from "./dashboard-client";

export const dynamic = "force-dynamic";

/**
 * "Tu negocio en una pantalla".
 *
 * Un solo viaje a la base: `dashboard_summary` arma todo en SQL, con las cotas
 * de fecha adentro (hoy, últimos 7 días, promedio de 28) y cortando el día en la
 * timezone del negocio. Antes acá vivía un fixture; ya no queda ninguno.
 */
export default async function AdminDashboard() {
  const session = await requireOwner();
  const supabase = await createSupabaseServer();

  // Primer día del mes actual (imputación por `incurred_on`). Query mínima y
  // acotada: solo saber SI hay algún gasto activo este mes, sin traer montos.
  const hoy = new Date();
  const inicioMes = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);

  const [{ data }, { count: gastosEsteMes, error: errGastos }, { count: sinControl }] =
    await Promise.all([
      supabase.rpc("dashboard_summary", { p_store_id: session.store.id }),
      supabase
        .from("expenses")
        .select("id", { count: "exact", head: true })
        .eq("store_id", session.store.id)
        .eq("status", "active")
        .gte("incurred_on", inicioMes)
        .limit(1),
      /* Puesta en marcha (038): cuántos productos se venden pero todavía no
         tienen control de stock. Sus alertas están apagadas —a propósito— y el
         dueño tiene que poder VERLO. Es un count(*) head sobre el índice parcial
         `products_no_confiables_idx`: no trae filas. */
      supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("store_id", session.store.id)
        .eq("status", "active")
        .eq("stock_confiable", false),
    ]);

  // Fail-safe: si no pudimos saberlo (tabla/RLS), NO molestamos con el nudge.
  const sinGastosEsteMes = !errGastos && (gastosEsteMes ?? 0) === 0;

  return (
    <AppShell
      current="/admin"
      storeName={session.store.name}
      userLabel={`${session.member.display_name ?? "Vos"} · Dueño`}
    >
      <DashboardClient
        data={data as DashboardData}
        timezone={session.store.timezone}
        sinGastosEsteMes={sinGastosEsteMes}
        sinControlStock={sinControl ?? 0}
      />
    </AppShell>
  );
}
