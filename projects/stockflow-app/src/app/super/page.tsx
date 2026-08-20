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

  /* La misma ventana de 36 meses que las otras dos consultas de ingresos, en un
     solo lugar para que no se desincronicen. */
  const hoy = new Date();
  const hoyISO = hoy.toISOString().slice(0, 10);
  const desde36 = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - 35, 1))
    .toISOString()
    .slice(0, 10);

  /* Las dos lecturas son independientes: en paralelo, no en cadena (baseline).
     La grilla trae 6 meses —la ventana que la UI muestra— y no la historia
     entera: la cota vive en el argumento y además está topeada en la RPC. */
  const [
    { data },
    { data: grilla },
    { data: seguimiento },
    { data: ingresos },
    { data: cobradoCliente },
    { data: pagos },
  ] = await Promise.all([
    admin
      .from("admin_stores")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200),
    admin.rpc("cobranza_grilla", { p_meses: 6 }),
    /* 067 · el seguimiento entra en la MISMA tanda: encadenarlo sumaría
       latencia a cambio de nada. */
    admin.rpc("resumen_seguimiento"),
    /* 068 · los ingresos. Ventana de 36 meses acotada EN LA RPC: el panel
       filtra por mes y por año en memoria, así que cambiar el período no
       vuelve al servidor. */
    admin.rpc("ingresos_mensuales", { p_meses: 36 }),
    admin.rpc("cobrado_por_cliente_mes", { p_meses: 36 }),
    /* 069 · los pagos individuales, para conciliar contra el banco. Van por
       `pagado_el` (cuándo entró la plata) y no por período ni por fecha de
       carga: el resumen bancario está ordenado por el día del movimiento. */
    admin.rpc("pagos_asentados", { p_desde: desde36, p_hasta: hoyISO }),
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

  return (
    <SuperClient
      stores={stores}
      email={email}
      celdas={celdas}
      meses={((ingresos ?? []) as {
        mes: string;
        comprometido: string | number;
        cobrado: string | number;
        pagaron: number;
        en_curso: boolean;
      }[]).map((m) => ({
        mes: m.mes,
        comprometido: Number(m.comprometido),
        cobrado: Number(m.cobrado),
        pagaron: Number(m.pagaron),
        enCurso: Boolean(m.en_curso),
      }))}
      porCliente={((cobradoCliente ?? []) as {
        store_id: string;
        nombre: string;
        mes: string;
        cobrado: string | number;
      }[]).map((c) => ({
        storeId: c.store_id,
        nombre: c.nombre,
        mes: c.mes,
        cobrado: Number(c.cobrado),
      }))}
      pagos={((pagos ?? []) as {
        id: string;
        negocio: string;
        periodo: string;
        monto: string | number;
        medio: string;
        nota: string | null;
        pagado_el: string;
        a_destiempo: boolean;
      }[]).map((p) => ({
        id: p.id,
        negocio: p.negocio,
        periodo: p.periodo,
        monto: Number(p.monto),
        medio: p.medio,
        nota: p.nota,
        pagadoEl: p.pagado_el,
        aDestiempo: Boolean(p.a_destiempo),
      }))}
    />
  );
}
