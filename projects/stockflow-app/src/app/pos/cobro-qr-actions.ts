"use server";

import { z } from "zod";
import { requireSession } from "@/lib/session";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { qrSvg } from "@/lib/qr";
import {
  getStoreMpAuth,
  mpCrearOrdenQR,
  mpCrearOrdenPoint,
  mpCancelarOrden,
  mpLeerOrden,
  ordenAprobada,
  ordenTerminada,
  idDePago,
  montoPagado,
} from "@/lib/mercadopago";

/**
 * Cobro con QR en el mostrador.
 *
 * El orden importa: primero pedimos el QR, el cliente paga, y RECIÉN AHÍ se
 * registra la venta con `register_sale`. No hay venta fantasma esperando un pago
 * que nunca llega.
 *
 * El carrito viaja al intento (columna `items`) porque si la caja se cae con el
 * cobro ya hecho, la venta se recupera desde la pantalla de Caja. La plata entró;
 * la venta no se pierde.
 */

const itemSchema = z.object({
  product_id: z.guid().nullable(),
  qty: z.number().positive(),
  unit_price: z.number().nonnegative().nullable().optional(),
  free_amount: z.number().positive().nullable().optional(),
  name: z.string().max(80).nullable().optional(),
});

const crearSchema = z.object({
  items: z.array(itemSchema).min(1),
  amount: z.number().positive(),
  idempotency_key: z.string().min(8).max(64),
  descripcion: z.string().max(120).optional(),
  client_id: z.guid().nullable().optional(),
});

export type CobroQR =
  | { ok: true; intentId: string; qrSvg: string; amount: number }
  | { ok: false; error: string; sinCuenta?: boolean };

export async function crearCobroQR(input: unknown): Promise<CobroQR> {
  const session = await requireSession();

  const parsed = crearSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos del cobro inválidos." };

  if (!(await checkRateLimit(`cobro-qr:${session.store.id}`, 60, 60))) {
    return { ok: false, error: "Demasiados cobros seguidos. Esperá unos segundos." };
  }

  const auth = await getStoreMpAuth(session.store.id);
  if (!auth) {
    return {
      ok: false,
      sinCuenta: true,
      error: "Este negocio todavía no conectó su cuenta de MercadoPago.",
    };
  }
  if (!auth.externalPosId) {
    return { ok: false, sinCuenta: true, error: "Falta terminar de configurar la caja en MercadoPago." };
  }

  // El intento primero: el monto lo valida la base contra el carrito, no el cliente.
  const supabase = await createSupabaseServer();
  const { data: intento, error } = await supabase.rpc("crear_intento_cobro", {
    p_store_id: session.store.id,
    p_items: parsed.data.items,
    p_amount: parsed.data.amount,
    p_idempotency_key: parsed.data.idempotency_key,
    p_client_id: parsed.data.client_id ?? null,
  });

  if (error || !intento) return { ok: false, error: "No pudimos preparar el cobro." };

  const row = intento as { id: string; amount: string; qr_data: string | null };

  // Reintento del mismo cobro: el QR ya existe, no pedimos otro.
  if (row.qr_data) {
    return { ok: true, intentId: row.id, qrSvg: qrSvg(row.qr_data), amount: Number(row.amount) };
  }

  const orden = await mpCrearOrdenQR({
    token: auth.token,
    externalPosId: auth.externalPosId,
    amount: Number(row.amount),
    externalReference: row.id,
    descripcion: parsed.data.descripcion ?? `Venta ${session.store.name}`,
  });

  if (!orden.ok) {
    await createAdminClient().from("payment_intents").update({ status: "cancelled" }).eq("id", row.id);
    return { ok: false, error: `MercadoPago no pudo generar el QR: ${orden.error}` };
  }

  const qrData = orden.orden.type_response!.qr_data!;
  await createAdminClient()
    .from("payment_intents")
    .update({ mp_order_id: String(orden.orden.id), qr_data: qrData })
    .eq("id", row.id);

  return { ok: true, intentId: row.id, qrSvg: qrSvg(qrData), amount: Number(row.amount) };
}

export type CobroPoint =
  | { ok: true; intentId: string; amount: number }
  | { ok: false; error: string; sinCuenta?: boolean; sinTerminal?: boolean };

/**
 * Traduce el error crudo de MercadoPago a algo que el cajero entienda. Sin esto, el
 * mostrador veía cosas como `{"errors":[{"code":"idempotency_key_already_used"…`.
 */
function mensajeTerminal(raw: string): string {
  const r = raw.toLowerCase();
  if (r.includes("idempotency")) return "Ese cobro ya se había enviado. Cerrá y probá de nuevo.";
  if (r.includes("mode") || r.includes("pdv") || r.includes("operating"))
    return "La terminal no está en modo integrado. Ponela en modo PDV desde tu app de MercadoPago.";
  if (r.includes("offline") || r.includes("unavailable") || r.includes("not connected") || r.includes("disconnected"))
    return "La terminal está apagada o sin conexión. Prendela y probá de nuevo.";
  if (r.includes("terminal") || r.includes("device") || r.includes("not found") || r.includes("does not"))
    return "No encontramos esa terminal. Revisá el id en Ajustes.";
  return "No pudimos enviar el cobro a la terminal. Probá de nuevo o cobrá con el QR en pantalla.";
}

/**
 * Cobro con terminal Point (Cobros Fase 2). Mismo esqueleto que `crearCobroQR`: el
 * intento primero (la base fija el monto contra el carrito), y RECIÉN AHÍ se empuja
 * el monto a la terminal física. La venta se registra después de que la terminal
 * confirme el pago — la misma disciplina "sin venta fantasma" que el QR.
 *
 * El seguimiento (`estadoCobro`) y el cierre (`cancelarCobro`, `vincularVenta`) son
 * los MISMOS del QR: leen la orden por `mp_order_id` sin importar el método. Acá solo
 * cambia el empujón (a la terminal en vez de devolver un QR).
 */
export async function crearCobroPoint(input: unknown): Promise<CobroPoint> {
  const session = await requireSession();

  const parsed = crearSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos del cobro inválidos." };

  if (!(await checkRateLimit(`cobro-point:${session.store.id}`, 60, 60))) {
    return { ok: false, error: "Demasiados cobros seguidos. Esperá unos segundos." };
  }

  const auth = await getStoreMpAuth(session.store.id);
  if (!auth) {
    return { ok: false, sinCuenta: true, error: "Este negocio todavía no conectó su cuenta de MercadoPago." };
  }
  if (!auth.mpTerminalId) {
    return { ok: false, sinTerminal: true, error: "Todavía no configuraste la terminal Point en Ajustes." };
  }

  const supabase = await createSupabaseServer();
  const { data: intento, error } = await supabase.rpc("crear_intento_cobro", {
    p_store_id: session.store.id,
    p_items: parsed.data.items,
    p_amount: parsed.data.amount,
    p_idempotency_key: parsed.data.idempotency_key,
    p_client_id: parsed.data.client_id ?? null,
  });

  if (error || !intento) return { ok: false, error: "No pudimos preparar el cobro." };

  const row = intento as { id: string; amount: string };

  const orden = await mpCrearOrdenPoint({
    token: auth.token,
    terminalId: auth.mpTerminalId,
    amount: Number(row.amount),
    externalReference: row.id,
    descripcion: parsed.data.descripcion ?? `Venta ${session.store.name}`,
  });

  if (!orden.ok) {
    await createAdminClient().from("payment_intents").update({ status: "cancelled" }).eq("id", row.id);
    return { ok: false, error: mensajeTerminal(orden.error) };
  }

  await createAdminClient()
    .from("payment_intents")
    .update({ mp_order_id: String(orden.orden.id) })
    .eq("id", row.id);

  return { ok: true, intentId: row.id, amount: Number(row.amount) };
}

export type EstadoCobro =
  | { estado: "pendiente" }
  | { estado: "pagado" }
  | { estado: "vencido" }
  | { estado: "error"; error: string };

/**
 * Consulta si ya pagaron. La caja llama esto cada par de segundos.
 *
 * Le preguntamos a MercadoPago y no a nuestra base: la verdad del pago vive allá,
 * y el webhook puede tardar o no llegar nunca. Que el kiosquero dependa de un
 * webhook para saber si le pagaron sería frágil justo en el peor momento.
 */
export async function estadoCobro(intentId: string): Promise<EstadoCobro> {
  const session = await requireSession();
  if (!z.guid().safeParse(intentId).success) return { estado: "error", error: "Cobro inválido." };

  // Cada llamada golpea la API de MercadoPago con el token del negocio. El poll
  // legítimo es de ~24/min por caja; el techo por negocio deja lugar a varias
  // cajas a la vez pero corta un loop desbocado antes de que martille a MP. Es
  // fail-open (checkRateLimit ya devuelve true si su RPC falla): nunca dejamos a
  // una caja sin saber si le pagaron por un problema del contador.
  if (!(await checkRateLimit(`estado-cobro:${session.store.id}`, 240, 60))) {
    return { estado: "pendiente" };
  }

  const supabase = await createSupabaseServer();
  const { data } = await supabase
    .from("payment_intents")
    .select("id, status, amount, mp_order_id, expires_at")
    .eq("id", intentId)
    .maybeSingle();

  if (!data) return { estado: "error", error: "No encontramos ese cobro." };
  if (data.status === "approved") return { estado: "pagado" };
  if (data.status !== "pending") return { estado: "vencido" };
  if (!data.mp_order_id) return { estado: "pendiente" };

  if (new Date(data.expires_at as string).getTime() < Date.now()) {
    await createAdminClient().from("payment_intents").update({ status: "expired" }).eq("id", intentId);
    return { estado: "vencido" };
  }

  const auth = await getStoreMpAuth(session.store.id);
  if (!auth) return { estado: "pendiente" };

  const res = await mpLeerOrden(auth.token, String(data.mp_order_id));
  // Un error de red no es "no pagó": seguimos esperando en lugar de mentirle a la caja.
  if (!res.ok) return { estado: "pendiente" };

  if (ordenAprobada(res.orden)) {
    // Binding de monto REAL: se compara el monto ACREDITADO en MP (no `total_amount`,
    // que es el que nosotros pedimos y siempre coincide) contra el del intento.
    const pagado = montoPagado(res.orden);
    if (pagado !== null && Math.abs(pagado - Number(data.amount)) > 0.01) {
      return { estado: "error", error: "El monto pagado no coincide con la venta." };
    }
    await createAdminClient()
      .from("payment_intents")
      .update({ status: "approved", mp_payment_id: idDePago(res.orden) })
      .eq("id", intentId)
      .eq("status", "pending");
    return { estado: "pagado" };
  }

  if (ordenTerminada(res.orden)) {
    await createAdminClient().from("payment_intents").update({ status: "expired" }).eq("id", intentId);
    return { estado: "vencido" };
  }

  return { estado: "pendiente" };
}

/**
 * El cliente se arrepintió o paga en efectivo: soltamos el cobro.
 *
 * RECONCILIA con MP antes de dar por muerto el cobro (H2): si el cliente alcanzó a
 * pagar en la carrera con el tap de "cancelar", NO se cancela — se marca aprobado
 * para que la plata capturada aparezca en el banner de recuperación de Caja en vez
 * de desaparecer de todas las vistas. Solo si MP confirma que NO se pagó, se cancela.
 */
export async function cancelarCobro(intentId: string): Promise<void> {
  const session = await requireSession();
  if (!z.guid().safeParse(intentId).success) return;

  const supabase = await createSupabaseServer();

  const { data: intent } = await supabase
    .from("payment_intents")
    .select("id, amount, mp_order_id, status")
    .eq("id", intentId)
    .eq("store_id", session.store.id)
    .maybeSingle();

  if (intent?.status === "pending" && intent.mp_order_id) {
    const auth = await getStoreMpAuth(session.store.id);
    if (auth) {
      const res = await mpLeerOrden(auth.token, String(intent.mp_order_id));
      if (res.ok && ordenAprobada(res.orden)) {
        const pagado = montoPagado(res.orden);
        if (pagado === null || Math.abs(pagado - Number(intent.amount)) <= 0.01) {
          // Pagó de verdad: reconciliar a aprobado (service_role), NO cancelar.
          await createAdminClient()
            .from("payment_intents")
            .update({ status: "approved", mp_payment_id: idDePago(res.orden) })
            .eq("id", intentId)
            .eq("status", "pending");
          return;
        }
      }
      // No pagó: cancelamos la orden en MP (best-effort). En Point esto saca el
      // monto de la pantalla de la terminal; en QR libera el código. Si ya está en
      // la terminal, MP rechaza el cancel y hay que cortar desde el aparato — por
      // eso el error se ignora.
      await mpCancelarOrden(auth.token, String(intent.mp_order_id));
    }
  }

  await supabase.rpc("cancelar_intento", {
    p_store_id: session.store.id,
    p_intent_id: intentId,
  });
}

/** Deja asentado que esta venta salió de este cobro (cierra el círculo). */
export async function vincularVenta(intentId: string, saleId: string): Promise<void> {
  const session = await requireSession();
  if (!z.guid().safeParse(intentId).success || !z.guid().safeParse(saleId).success) return;

  const supabase = await createSupabaseServer();
  await supabase.rpc("vincular_venta_a_cobro", {
    p_store_id: session.store.id,
    p_intent_id: intentId,
    p_sale_id: saleId,
  });
}
