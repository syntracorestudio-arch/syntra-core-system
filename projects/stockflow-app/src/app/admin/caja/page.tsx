import { AppShell } from "@/components/shell/app-shell";
import { requireSession } from "@/lib/session";
import { createSupabaseServer } from "@/lib/supabase/server";
import { CajaClient, type CierreData } from "./caja-client";

export const dynamic = "force-dynamic";

export default async function CajaPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string }>;
}) {
  const sp = await searchParams;
  const session = await requireSession();
  const supabase = await createSupabaseServer();

  // Fecha explícita para poder revisar días anteriores; por defecto, hoy.
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(sp.d ?? "") ? sp.d : null;

  const { data } = await supabase.rpc("cierre_caja", {
    p_store_id: session.store.id,
    p_fecha: fecha,
  });

  return (
    <AppShell
      current="/admin/caja"
      storeName={session.store.name}
      userLabel={`${session.member.display_name ?? "Vos"} · ${
        session.member.role === "owner" ? "Dueño" : "Empleado"
      }`}
    >
      <CajaClient
        data={data as CierreData}
        puedeAnular={session.member.role === "owner" || session.member.can_void_sale}
        timezone={session.store.timezone}
      />
    </AppShell>
  );
}
