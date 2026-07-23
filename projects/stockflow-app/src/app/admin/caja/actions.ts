"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase/server";
import { requireSession } from "@/lib/session";

export type Result = { ok: true } | { ok: false; error: string };

/**
 * Anular una venta.
 *
 * En un mostrador esto pasa todos los días: se cobra de más, el cliente devuelve
 * algo, se carga el producto equivocado. Sin esta acción el kiosquero queda
 * atrapado con un error que no puede corregir, y termina desconfiando de todos
 * los números.
 *
 * La RPC no borra nada: genera contra-asientos que devuelven el stock y, si era
 * fiado, revierten la deuda. El historial queda entero.
 */
export async function anularVenta(saleId: string, motivo: string): Promise<Result> {
  const session = await requireSession();

  if (!(session.member.role === "owner" || session.member.can_void_sale)) {
    return { ok: false, error: "No tenés permiso para anular ventas." };
  }

  const supabase = await createSupabaseServer();
  const { error } = await supabase.rpc("void_sale", {
    p_store_id: session.store.id,
    p_sale_id: saleId,
    p_reason: motivo.trim() || null,
  });

  if (error) {
    if (error.message.includes("not_allowed")) {
      return { ok: false, error: "No tenés permiso para anular ventas." };
    }
    if (error.message.includes("sale_not_found")) {
      return { ok: false, error: "Esa venta ya no existe." };
    }
    return { ok: false, error: "No pudimos anular la venta." };
  }

  revalidatePath("/admin/caja");
  revalidatePath("/admin");
  revalidatePath("/pos");
  return { ok: true };
}

/**
 * Registra la venta de un cobro con QR que se acreditó y quedó huérfano.
 *
 * Usa la MISMA clave de idempotencia del cobro: si la caja alcanzó a registrar la
 * venta antes de morirse y nosotros no nos enteramos, `register_sale` devuelve esa
 * venta en lugar de crear una segunda. No hay forma de duplicar cobrando dos veces.
 */
export async function recuperarVenta(intentId: string): Promise<Result> {
  const session = await requireSession();
  const supabase = await createSupabaseServer();

  const { data: intento } = await supabase
    .from("payment_intents")
    .select("id, items, idempotency_key, client_id, status, sale_id")
    .eq("id", intentId)
    .maybeSingle();

  if (!intento) return { ok: false, error: "No encontramos ese cobro." };
  if (intento.status !== "approved") return { ok: false, error: "Ese cobro no está acreditado." };
  if (intento.sale_id) return { ok: true }; // otra pestaña se nos adelantó

  const { data, error } = await supabase.rpc("register_sale", {
    p_store_id: session.store.id,
    p_items: intento.items,
    p_payment_method: "qr",
    p_idempotency_key: intento.idempotency_key,
    p_client_id: intento.client_id,
  });

  if (error || !data) return { ok: false, error: "No pudimos registrar la venta." };

  await supabase.rpc("vincular_venta_a_cobro", {
    p_store_id: session.store.id,
    p_intent_id: intentId,
    p_sale_id: (data as { sale_id: string }).sale_id,
  });

  revalidatePath("/admin/caja");
  revalidatePath("/admin");
  revalidatePath("/pos");
  return { ok: true };
}
