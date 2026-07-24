import { AppShell } from "@/components/shell/app-shell";
import { requireOwner } from "@/lib/session";
import { createSupabaseServer } from "@/lib/supabase/server";
import { GastosClient, type ExpenseRow } from "./gastos-client";

export const dynamic = "force-dynamic";

export default async function GastosPage() {
  const session = await requireOwner();
  const supabase = await createSupabaseServer();

  // Query acotada (baseline): piso de ~24 meses, orden por imputación desc, tope
  // de filas. RLS owner-only + requireOwner protegen el acceso.
  const piso = new Date();
  piso.setUTCMonth(piso.getUTCMonth() - 24);
  const desde = piso.toISOString().slice(0, 10);

  const { data } = await supabase
    .from("expenses")
    .select(
      "id, category, amount, incurred_on, note, is_recurring, status, void_reason, created_at",
    )
    .eq("store_id", session.store.id)
    .gte("incurred_on", desde)
    .order("incurred_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(500);

  const rows: ExpenseRow[] = (data ?? []).map((e) => ({
    id: e.id,
    category: e.category,
    amount: Number(e.amount),
    incurred_on: e.incurred_on,
    note: e.note,
    is_recurring: e.is_recurring,
    status: e.status,
    void_reason: e.void_reason,
    created_at: e.created_at,
  }));

  return (
    <AppShell
      current="/admin/gastos"
      storeName={session.store.name}
      userLabel={`${session.member.display_name ?? "Vos"} · Dueño`}
    >
      <GastosClient expenses={rows} />
    </AppShell>
  );
}
