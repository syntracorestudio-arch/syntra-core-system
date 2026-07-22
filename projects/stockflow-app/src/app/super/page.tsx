import { requireSuperadmin } from "@/lib/superadmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { SuperClient, type StoreRow } from "./super-client";

export const dynamic = "force-dynamic";

export default async function SuperPage() {
  const { email } = await requireSuperadmin();

  // Admin client: es la única pantalla que cruza tenants a propósito, detrás del
  // guard de superadmin. La vista no está otorgada a `authenticated`.
  const admin = createAdminClient();
  const { data } = await admin
    .from("admin_stores")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  const stores: StoreRow[] = (data ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    slug: s.slug,
    status: s.status,
    dueno: s.dueno,
    miembros: Number(s.miembros),
    productos: Number(s.productos),
    ventas: Number(s.ventas),
    ultimaVenta: s.ultima_venta,
    createdAt: s.created_at,
  }));

  return <SuperClient stores={stores} email={email} />;
}
