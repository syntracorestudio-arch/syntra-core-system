import { AppShell } from "@/components/shell/app-shell";
import { requireSession } from "@/lib/session";
import { createSupabaseServer } from "@/lib/supabase/server";
import { CajaClient, type CierreData } from "./caja-client";
import { CobrosHuerfanos, type CobroHuerfano } from "./cobros-huerfanos";

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

  const [{ data }, { data: huerfanos }] = await Promise.all([
    supabase.rpc("cierre_caja", { p_store_id: session.store.id, p_fecha: fecha }),
    supabase.rpc("cobros_sin_venta", { p_store_id: session.store.id }),
  ]);

  const cobros = (huerfanos ?? []) as CobroHuerfano[];

  return (
    <AppShell
      current="/admin/caja"
      storeName={session.store.name}
      userLabel={`${session.member.display_name ?? "Vos"} · ${
        session.member.role === "owner" ? "Dueño" : "Empleado"
      }`}
    >
      {cobros.length > 0 && (
        <div className="mx-auto max-w-3xl px-4 pt-6 lg:px-8 lg:pt-8">
          <CobrosHuerfanos cobros={cobros} />
        </div>
      )}
      <CajaClient
        data={data as CierreData}
        puedeAnular={session.member.role === "owner" || session.member.can_void_sale}
        timezone={session.store.timezone}
      />
    </AppShell>
  );
}
