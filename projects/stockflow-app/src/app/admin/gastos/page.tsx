import { AppShell } from "@/components/shell/app-shell";
import { requireOwner } from "@/lib/session";
import { createSupabaseServer } from "@/lib/supabase/server";
import {
  MAX_LOOKBACK_DAYS,
  addDays,
  clampAnchor,
  endOfMonth,
  startOfMonth,
  todayInTz,
} from "@/lib/date";
import { GastosClient, type ExpenseRow } from "./gastos-client";

export const dynamic = "force-dynamic";

const MES_RE = /^\d{4}-\d{2}$/;

export default async function GastosPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const sp = await searchParams;
  const session = await requireOwner();
  const supabase = await createSupabaseServer();

  // Mes elegido (?m=YYYY-MM) como fecha ABSOLUTA, en la zona DEL NEGOCIO, encajonado
  // al piso de 24 meses / sin futuro — misma lógica que Reportes.
  const hoy = todayInTz(session.store.timezone);
  const anchor = clampAnchor(MES_RE.test(sp.m ?? "") ? `${sp.m}-01` : startOfMonth(hoy), hoy);
  const desde = startOfMonth(anchor);
  const hasta = endOfMonth(anchor);
  const floor = addDays(hoy, -MAX_LOOKBACK_DAYS);

  // Query acotada AL MES elegido (más ajustada aún que el piso) + un chequeo barato
  // de existencia para distinguir "sin gastos este mes" de "nunca cargó nada".
  const [{ data }, { data: existe }] = await Promise.all([
    supabase
      .from("expenses")
      .select(
        "id, category, amount, incurred_on, note, is_recurring, status, void_reason, created_at",
      )
      .eq("store_id", session.store.id)
      .gte("incurred_on", desde)
      .lte("incurred_on", hasta)
      .order("incurred_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("expenses")
      .select("id")
      .eq("store_id", session.store.id)
      .gte("incurred_on", floor)
      .limit(1),
  ]);

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
      <GastosClient
        expenses={rows}
        anchor={desde}
        today={hoy}
        hayGastos={(existe ?? []).length > 0}
      />
    </AppShell>
  );
}
