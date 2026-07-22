import { AppShell } from "@/components/shell/app-shell";
import { requireSession } from "@/lib/session";
import { createSupabaseServer } from "@/lib/supabase/server";
import { FiadoClient, type ClientRow } from "./fiado-client";

export const dynamic = "force-dynamic";

export default async function FiadoPage() {
  const session = await requireSession();
  const supabase = await createSupabaseServer();

  // Saldos derivados del ledger (nunca un contador) + última vez que se movió la
  // cuenta, que es lo que le dice al dueño si la deuda está viva o dormida.
  const [{ data: balances }, { data: movimientos }] = await Promise.all([
    supabase
      .from("client_balances")
      .select("client_id, name, credit_limit, balance")
      .order("balance")
      .limit(300),
    supabase
      .from("client_ledger")
      .select("client_id, created_at")
      .order("created_at", { ascending: false })
      .limit(1000),
  ]);

  const ultimo = new Map<string, string>();
  for (const m of movimientos ?? []) {
    if (!ultimo.has(m.client_id)) ultimo.set(m.client_id, m.created_at);
  }

  const rows: ClientRow[] = (balances ?? []).map((c) => ({
    id: c.client_id,
    name: c.name,
    creditLimit: c.credit_limit === null ? null : Number(c.credit_limit),
    balance: Number(c.balance),
    lastMovement: ultimo.get(c.client_id) ?? null,
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
