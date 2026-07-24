import { AppShell } from "@/components/shell/app-shell";
import { requireSession } from "@/lib/session";
import { createSupabaseServer } from "@/lib/supabase/server";
import { FiadoClient, type ClientRow } from "./fiado-client";

export const dynamic = "force-dynamic";

/** El reloj es impuro: fuera del cuerpo del componente (patrón de Reportes). */
function desdeHace(dias: number): string {
  return new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * Desde cuándo debe y cuándo pagó por última vez.
 *
 * "Debe desde" no es la fecha del último movimiento —esa esconde deudas viejas
 * que siguen creciendo— sino el arranque del tramo en que la cuenta quedó en
 * rojo y nunca más volvió a cero. Es lo que separa al cliente que fía y paga
 * todas las semanas del que se está colgando.
 *
 * Recorre de más viejo a más nuevo llevando el saldo corrido; cada vez que la
 * cuenta vuelve a cero o a favor, el tramo se reinicia.
 */
function analizarDeuda(
  mov: { created_at: string; delta: number; reason: string }[],
): { debeDesde: string | null; ultimoPago: string | null } {
  let saldo = 0;
  let desde: string | null = null;
  let ultimoPago: string | null = null;

  for (const m of mov) {
    const antes = saldo;
    saldo += m.delta;
    if (m.reason === "payment") ultimoPago = m.created_at;
    if (antes >= 0 && saldo < 0) desde = m.created_at; // entra en rojo
    if (saldo >= 0) desde = null; // se puso al día: el tramo se cierra
  }

  return { debeDesde: saldo < 0 ? desde : null, ultimoPago };
}

export default async function FiadoPage() {
  const session = await requireSession();
  const supabase = await createSupabaseServer();

  // Saldos derivados del ledger (nunca un contador) + el historial con el que
  // calculamos desde cuándo debe y cuándo pagó por última vez.
  const [{ data: balances }, { data: movimientos }] = await Promise.all([
    supabase
      .from("client_balances")
      .select("client_id, name, credit_limit, balance")
      .order("balance")
      .limit(300),
    supabase
      .from("client_ledger")
      .select("client_id, created_at, delta, reason")
      .gte("created_at", desdeHace(365))
      .order("created_at", { ascending: true })
      .limit(3000),
  ]);

  const historial = new Map<string, { created_at: string; delta: number; reason: string }[]>();
  for (const m of movimientos ?? []) {
    const list = historial.get(m.client_id) ?? [];
    list.push({ created_at: m.created_at, delta: Number(m.delta), reason: m.reason });
    historial.set(m.client_id, list);
  }

  const rows: ClientRow[] = (balances ?? []).map((c) => {
    const mov = historial.get(c.client_id) ?? [];
    const { debeDesde, ultimoPago } = analizarDeuda(mov);
    return {
      id: c.client_id,
      name: c.name,
      creditLimit: c.credit_limit === null ? null : Number(c.credit_limit),
      balance: Number(c.balance),
      lastMovement: mov.length > 0 ? mov[mov.length - 1].created_at : null,
      debeDesde,
      ultimoPago,
    };
  });

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
