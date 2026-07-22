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

  const { data } = await supabase.rpc("dashboard_summary", {
    p_store_id: session.store.id,
  });

  return (
    <AppShell
      current="/admin"
      storeName={session.store.name}
      userLabel={`${session.member.display_name ?? "Vos"} · Dueño`}
    >
      <DashboardClient
        data={data as DashboardData}
        timezone={session.store.timezone}
      />
    </AppShell>
  );
}
