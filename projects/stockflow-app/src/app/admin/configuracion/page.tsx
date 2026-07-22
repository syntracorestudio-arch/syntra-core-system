import { AppShell } from "@/components/shell/app-shell";
import { requireOwner } from "@/lib/session";
import { createSupabaseServer } from "@/lib/supabase/server";
import { ConfiguracionClient, type Settings } from "./configuracion-client";

export const dynamic = "force-dynamic";

export default async function ConfiguracionPage() {
  const session = await requireOwner();
  const supabase = await createSupabaseServer();

  const { data } = await supabase
    .from("store_settings")
    .select("expiry_warning_days, low_stock_threshold_default, reprice_rounding, allow_negative_stock")
    .eq("store_id", session.store.id)
    .maybeSingle();

  const settings: Settings = {
    expiryWarningDays: data?.expiry_warning_days ?? 7,
    lowStockThresholdDefault: data?.low_stock_threshold_default ?? 3,
    repriceRounding: Number(data?.reprice_rounding ?? 50),
    allowNegativeStock: data?.allow_negative_stock ?? true,
  };

  return (
    <AppShell
      current="/admin/configuracion"
      storeName={session.store.name}
      userLabel={`${session.member.display_name ?? "Vos"} · Dueño`}
    >
      <ConfiguracionClient settings={settings} storeName={session.store.name} />
    </AppShell>
  );
}
