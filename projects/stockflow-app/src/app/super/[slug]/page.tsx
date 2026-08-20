import { notFound } from "next/navigation";
import { requireSuperadmin } from "@/lib/superadmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { FichaCliente, type Pago, type EntradaBitacora } from "./ficha-client";
import type { StoreRow, Suscripcion } from "../super-client";

export const dynamic = "force-dynamic";

/**
 * La ficha de un cliente.
 *
 * POR QUÉ UNA PANTALLA Y NO UN DIÁLOGO MÁS. El motivo no es el volumen de
 * datos, es la HISTORIA: el historial de pagos, la bitácora y las notas son
 * exactamente lo que se lee MIENTRAS se habla por teléfono con el cliente, y eso
 * no entra en un diálogo que tapa la lista de atrás. Los diálogos que ya existen
 * (alta, credenciales, pago) se quedan como están: son actos de un paso.
 *
 * La fila de la cartera NAVEGA acá; no se expande.
 */
export default async function FichaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { email } = await requireSuperadmin();
  const { slug } = await params;

  const admin = createAdminClient();

  const { data: fila } = await admin
    .from("admin_stores")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (!fila) notFound();

  /* Las tres lecturas restantes son independientes entre sí: en paralelo.
     Las tres están acotadas — 12 meses de pagos, 50 entradas de bitácora — no
     porque hoy haya volumen, sino porque la ficha de un cliente de tres años no
     puede convertirse en una consulta sin techo. */
  const desde = new Date();
  desde.setUTCMonth(desde.getUTCMonth() - 11);
  const desdeISO = new Date(Date.UTC(desde.getUTCFullYear(), desde.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);

  const [{ data: pagos }, { data: bitacora }, { data: sub }] = await Promise.all([
    admin
      .from("subscription_payments")
      .select("periodo, monto, medio, nota, created_at")
      .eq("store_id", fila.id)
      .gte("periodo", desdeISO)
      .order("periodo", { ascending: false })
      .limit(200),
    admin.rpc("bitacora_del_negocio", { p_store_id: fila.id, p_limite: 50 }),
    admin
      .from("subscriptions")
      .select("notas, precio_mensual, cobra_desde, prueba_hasta, estado")
      .eq("store_id", fila.id)
      .maybeSingle(),
  ]);

  const store: StoreRow = {
    id: fila.id,
    name: fila.name,
    slug: fila.slug,
    status: fila.status,
    dueno: fila.dueno,
    miembros: Number(fila.miembros),
    productos: Number(fila.productos),
    ventas: Number(fila.ventas),
    ventas30d: Number(fila.ventas_30d ?? 0),
    ultimaVenta: fila.ultima_venta,
    createdAt: fila.created_at,
    vertical: fila.vertical ?? "kiosco",
    aiAssistant: Boolean(fila.ai_assistant_enabled),
    suscripcion: (fila.suscripcion ?? { estado: "sin_suscripcion" }) as Suscripcion,
  };

  return (
    <FichaCliente
      store={store}
      pagos={(pagos ?? []).map((p) => ({
        periodo: p.periodo as string,
        monto: Number(p.monto),
        medio: (p.medio as string | null) ?? null,
        nota: (p.nota as string | null) ?? null,
        cuando: p.created_at as string,
      })) satisfies Pago[]}
      bitacora={(bitacora ?? []) as EntradaBitacora[]}
      notas={(sub?.notas as string | null) ?? null}
      /* El alias sale del entorno y no de la base: es de SYNTRA, no de ningún
         negocio, y no tiene por qué viajar en ninguna tabla de clientes. Si no
         está seteado, el mensaje se arma sin esa línea en vez de decir
         "undefined" — un mensaje roto mandado a un cliente es peor que un
         mensaje incompleto que el que copia puede completar. */
      alias={process.env.STOCKFLOW_ALIAS_COBRO?.trim() || null}
      email={email}
    />
  );
}
