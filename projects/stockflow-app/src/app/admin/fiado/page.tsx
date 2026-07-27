import { AppShell } from "@/components/shell/app-shell";
import { requireOwner } from "@/lib/session";
import { createSupabaseServer } from "@/lib/supabase/server";
import { FiadoClient, type ClientRow } from "./fiado-client";

export const dynamic = "force-dynamic";

type FiadoRow = {
  client_id: string;
  name: string;
  credit_limit: number | string | null;
  balance: number | string;
  debe_desde: string | null;
  ultimo_pago: string | null;
};

export default async function FiadoPage() {
  // Fiado = herramienta de dueño: expone la deuda de todos los clientes. El
  // empleado no la ve (antes entraba por URL con requireSession). Auditoría T2 · M3.
  const session = await requireOwner();
  const supabase = await createSupabaseServer();

  // Saldos + aging (desde cuándo debe / último pago) en UNA sola RPC acotada y
  // correcta. La query client-side anterior traía el ledger STORE-WIDE con
  // gte(365d) + order-asc-limit(3000): en un negocio activo tiraba los movimientos
  // recientes y la deuda vieja, así que las etiquetas de cobro mentían. T3.
  const { data } = await supabase.rpc("fiado_resumen", { p_store_id: session.store.id });

  const rows: ClientRow[] = ((data ?? []) as FiadoRow[]).map((c) => ({
    id: c.client_id,
    name: c.name,
    creditLimit: c.credit_limit === null ? null : Number(c.credit_limit),
    balance: Number(c.balance),
    debeDesde: c.debe_desde,
    ultimoPago: c.ultimo_pago,
  }));

  return (
    <AppShell
      current="/admin/fiado"
      storeName={session.store.name}
      userLabel={`${session.member.display_name ?? "Vos"} · ${
        session.member.role === "owner" ? "Dueño" : "Empleado"
      }`}
    >
      <FiadoClient
        clients={rows}
        canCreate={session.member.role === "owner" || session.member.can_sell_on_credit}
      />
    </AppShell>
  );
}
