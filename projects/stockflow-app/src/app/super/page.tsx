import { requireSuperadmin } from "@/lib/superadmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { SuperClient, type StoreRow, type Suscripcion } from "./super-client";

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
    // 057 · la ventana que distingue "activo" de "vendió mucho hace un año".
    ventas30d: Number(s.ventas_30d ?? 0),
    ultimaVenta: s.ultima_venta,
    createdAt: s.created_at,
    vertical: s.vertical ?? "kiosco",
    aiAssistant: Boolean(s.ai_assistant_enabled),
    /* 057 · la cobranza viene calculada por `estado_suscripcion` DENTRO de la
       vista: el panel no recalcula nada, sólo muestra. La regla del día 10 vive
       en un solo lugar (SQL) y no se duplica acá — si se duplicara, el día que
       cambie el vencimiento habría dos verdades. */
    suscripcion: (s.suscripcion ?? { estado: "sin_suscripcion" }) as Suscripcion,
  }));

  return <SuperClient stores={stores} email={email} />;
}
