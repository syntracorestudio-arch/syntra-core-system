import { AppShell } from "@/components/shell/app-shell";
import { requireSession } from "@/lib/session";
import { createSupabaseServer } from "@/lib/supabase/server";
import { todayInTz } from "@/lib/date";
import {
  VencimientosClient,
  type ExpiryRow,
  type SugerenciaPromo,
} from "./vencimientos-client";

export const dynamic = "force-dynamic";

export default async function VencimientosPage() {
  const session = await requireSession();
  const supabase = await createSupabaseServer();

  // Cota explícita: sólo lo pendiente y hasta 180 días adelante. Un vencimiento
  // a dos años no es una alerta, es ruido (baseline: nada sin techo).
  /* Las sugerencias de promo se piden acá para que la fila pueda ofrecer
     "ponerlo en promo" sin sacar al dueño de la pantalla donde estaba
     decidiendo. Owner-only en SQL: para un empleado la RPC levanta
     `not_allowed`, así que ni se llama — Vencimientos no puede romperse por
     una feature del dueño. */
  const esOwner = session.member.role === "owner";

  const [{ data }, { data: productos }, { data: settings }, sugeridas] = await Promise.all([
    supabase
      .from("pending_expiries")
      .select("id, product_name, product_emoji, expiry_date, qty, days_left")
      .lte("days_left", 180)
      .order("expiry_date")
      .limit(200),
    supabase
      .from("products")
      .select("id, name, emoji")
      .eq("status", "active")
      .order("name")
      .limit(500),
    supabase
      .from("store_settings")
      .select("expiry_warning_days")
      .eq("store_id", session.store.id)
      .maybeSingle(),
    esOwner
      ? supabase
          .rpc("promos_sugeridas", { p_store_id: session.store.id })
          .then((r) => r.data ?? [])
      : Promise.resolve([]),
  ]);

  const rows: ExpiryRow[] = (data ?? []).map((e) => ({
    id: e.id,
    productName: e.product_name,
    productEmoji: e.product_emoji,
    expiryDate: e.expiry_date,
    qty: Number(e.qty),
    daysLeft: e.days_left,
  }));

  return (
    <AppShell
      current="/admin/vencimientos"
      storeName={session.store.name}
      userLabel={`${session.member.display_name ?? "Vos"} · ${
        session.member.role === "owner" ? "Dueño" : "Empleado"
      }`}
    >
      <VencimientosClient
        expiries={rows}
        products={(productos ?? []).map((p) => ({ id: p.id, name: p.name, emoji: p.emoji }))}
        sugerencias={(sugeridas as SugerenciaPromo[]).filter((s) => s.aplicable)}
        hoy={todayInTz(session.store.timezone)}
        warningDays={settings?.expiry_warning_days ?? 7}
        canEdit={esOwner}
        vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null}
      />
    </AppShell>
  );
}
