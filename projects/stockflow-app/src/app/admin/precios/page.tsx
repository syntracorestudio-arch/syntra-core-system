import { AppShell } from "@/components/shell/app-shell";
import { requireOwner } from "@/lib/session";
import { createSupabaseServer } from "@/lib/supabase/server";
import { PreciosClient, type Erosionados } from "./precios-client";

export const dynamic = "force-dynamic";

export default async function PreciosPage() {
  const session = await requireOwner();
  const supabase = await createSupabaseServer();

  const { data } = await supabase.rpc("margenes_erosionados", {
    p_store_id: session.store.id,
  });

  return (
    <AppShell
      current="/admin/precios"
      storeName={session.store.name}
      userLabel={`${session.member.display_name ?? "Vos"} · Dueño`}
    >
      <PreciosClient datos={data as Erosionados} />
    </AppShell>
  );
}
