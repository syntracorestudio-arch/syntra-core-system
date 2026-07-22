import { AppShell } from "@/components/shell/app-shell";
import { requireOwner } from "@/lib/session";
import { createSupabaseServer } from "@/lib/supabase/server";
import { EquipoClient, type Miembro } from "./equipo-client";

export const dynamic = "force-dynamic";

export default async function EquipoPage() {
  const session = await requireOwner();
  const supabase = await createSupabaseServer();

  const { data } = await supabase.rpc("equipo_del_negocio", {
    p_store_id: session.store.id,
  });

  return (
    <AppShell
      current="/admin/equipo"
      storeName={session.store.name}
      userLabel={`${session.member.display_name ?? "Vos"} · Dueño`}
    >
      <EquipoClient miembros={(data ?? []) as Miembro[]} yoId={session.member.id} />
    </AppShell>
  );
}
