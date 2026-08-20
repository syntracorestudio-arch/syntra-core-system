import { requireSuperadmin } from "@/lib/superadmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { SuperClient, type StoreRow, type Suscripcion } from "./super-client";
import type { CeldaCobranza } from "./cobranza-grilla";

export const dynamic = "force-dynamic";

export default async function SuperPage() {
  const { email } = await requireSuperadmin();

  // Admin client: es la única pantalla que cruza tenants a propósito, detrás del
  // guard de superadmin. La vista no está otorgada a `authenticated`.
  const admin = createAdminClient();

  /* Las dos lecturas son independientes: en paralelo, no en cadena (baseline).
     La grilla trae 6 meses —la ventana que la UI muestra— y no la historia
     entera: la cota vive en el argumento y además está topeada en la RPC. */
  const [{ data }, { data: grilla }, { data: seguimiento }] = await Promise.all([
    admin
      .from("admin_stores")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200),
    admin.rpc("cobranza_grilla", { p_meses: 6 }),
    /* 067 · el seguimiento entra en la MISMA tanda: encadenarlo sumaría
       latencia a cambio de nada. */
    admin.rpc("resumen_seguimiento"),
  ]);

  /* Indexado por negocio para que la fila no recorra un array en cada render:
     con 30 filas da igual, pero es la clase de N² que después nadie encuentra. */
  const porNegocio = new Map(
    ((seguimiento ?? []) as {
      store_id: string;
      seguimiento_el: string | null;
      ultimo_contacto: string | null;
      contactos: number;
    }[]).map((r) => [r.store_id, r]),
  );

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
    seguimientoEl: porNegocio.get(s.id)?.seguimiento_el ?? null,
    ultimoContacto: porNegocio.get(s.id)?.ultimo_contacto ?? null,
    contactos: porNegocio.get(s.id)?.contactos ?? 0,
  }));

  const celdas: CeldaCobranza[] = (
    (grilla ?? []) as {
      store_id: string;
      mes: string;
      estado: CeldaCobranza["estado"];
      pagado: string | number;
      precio: string | number | null;
    }[]
  ).map((c) => ({
    storeId: c.store_id,
    mes: c.mes,
    estado: c.estado,
    // `numeric` de Postgres viaja como string: sin esto las comparaciones y el
    // formateo de plata operarían sobre texto.
    pagado: Number(c.pagado ?? 0),
    precio: c.precio === null ? null : Number(c.precio),
  }));

  return <SuperClient stores={stores} email={email} celdas={celdas} />;
}
