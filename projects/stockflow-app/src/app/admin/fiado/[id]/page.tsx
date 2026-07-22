import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { requireSession } from "@/lib/session";
import { createSupabaseServer } from "@/lib/supabase/server";
import { ClienteDetalle, type Movimiento } from "./cliente-detalle";

export const dynamic = "force-dynamic";

export default async function ClientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();
  const supabase = await createSupabaseServer();

  const [{ data: cliente }, { data: ledger }] = await Promise.all([
    supabase
      .from("client_balances")
      .select("client_id, name, credit_limit, balance")
      .eq("client_id", id)
      .maybeSingle(),
    // Cota explícita: el historial reciente alcanza para decidir. Si algún día
    // hace falta el completo, se pagina (baseline: nada sin techo).
    supabase
      .from("client_ledger")
      .select("id, delta, reason, payment_method, note, created_at")
      .eq("client_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  // La RLS ya filtra por negocio: si no aparece, o no existe o es de otro kiosco.
  if (!cliente) notFound();

  const { data: datos } = await supabase
    .from("clients")
    .select("phone, note")
    .eq("id", id)
    .maybeSingle();

  const movimientos: Movimiento[] = (ledger ?? []).map((m) => ({
    id: m.id,
    delta: Number(m.delta),
    reason: m.reason,
    paymentMethod: m.payment_method,
    note: m.note,
    createdAt: m.created_at,
  }));

  return (
    <AppShell
      current="/admin/fiado"
      storeName={session.store.name}
      userLabel={`${session.member.display_name ?? "Vos"} · ${
        session.member.role === "owner" ? "Dueño" : "Empleado"
      }`}
    >
      <ClienteDetalle
        clientId={id}
        name={cliente.name}
        phone={datos?.phone ?? null}
        creditLimit={cliente.credit_limit === null ? null : Number(cliente.credit_limit)}
        balance={Number(cliente.balance)}
        movimientos={movimientos}
        canCharge={session.member.role === "owner" || session.member.can_sell_on_credit}
        isOwner={session.member.role === "owner"}
      />
    </AppShell>
  );
}
