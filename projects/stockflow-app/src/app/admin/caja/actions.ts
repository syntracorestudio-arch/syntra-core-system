"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase/server";
import { requireOwner, requireSession } from "@/lib/session";
import { getStoreMpAuth, mpReembolsarOrden } from "@/lib/mercadopago";

export type Result = { ok: true } | { ok: false; error: string };

/**
 * ¿Está habilitado el reembolso? Money-critical: mueve plata real por una API nueva de
 * MercadoPago. Queda apagado por defecto hasta validarlo en el sandbox de MP (plan
 * `docs/split-dos-electronicas-plan.md`). Se prende con STOCKFLOW_REEMBOLSO_HABILITADO=1.
 *
 * Helper interno (no exportado): en un módulo "use server" todo export debe ser una
 * server action async. La UI lee el mismo env en el server component de la página.
 */
function reembolsoHabilitado(): boolean {
  return process.env.STOCKFLOW_REEMBOLSO_HABILITADO === "1";
}

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
  // Owner-only como la pantalla de Caja de la que sale (la action se despacha por
  // id, no por URL: se gatea acá también). Auditoría T2 · M3.
  const session = await requireOwner();
  const supabase = await createSupabaseServer();

  const { data: intento } = await supabase
    .from("payment_intents")
    .select("id, items, idempotency_key, client_id, status, sale_id, split_pagos")
    .eq("id", intentId)
    .maybeSingle();

  if (!intento) return { ok: false, error: "No encontramos ese cobro." };
  if (intento.status !== "approved") return { ok: false, error: "Ese cobro no está acreditado." };
  if (intento.sale_id) return { ok: true }; // otra pestaña se nos adelantó

  // Si el cobro era la parte QR de un pago dividido, se re-arma como SPLIT desde el
  // reparto guardado (no como una venta QR de carrito entero). La plata ya se acreditó
  // → p_paid=true. Si no, es un QR normal.
  const { data, error } = intento.split_pagos
    ? await supabase.rpc("register_split_sale", {
        p_store_id: session.store.id,
        p_items: intento.items,
        p_pagos: intento.split_pagos,
        p_idempotency_key: intento.idempotency_key,
        p_paid: true,
      })
    : await supabase.rpc("register_sale", {
        p_store_id: session.store.id,
        p_items: intento.items,
        p_payment_method: "qr",
        p_idempotency_key: intento.idempotency_key,
        p_client_id: intento.client_id,
        // La plata ya se acreditó (intento 'approved'): la venta es un hecho y debe
        // registrarse aunque el producto se haya archivado o el stock esté estricto. M4.
        p_paid: true,
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

/**
 * Reembolsa y anula un split "a medio cobrar": el cliente se fue con una pata cobrada y
 * la otra no. Devuelve por MercadoPago la plata de cada pata acreditada del grupo y la
 * marca 'refunded'; el grupo queda sin venta (nunca existió). Owner-only, como la Caja.
 *
 * Idempotente y resumible: solo toca patas todavía 'approved' (una ya reembolsada se
 * saltea), y el reembolso en MP lleva idempotency-key por pata → nunca devuelve dos veces.
 * Gateado por `reembolsoHabilitado()` hasta validarlo en el sandbox de MercadoPago.
 */
export async function reembolsarGrupo(groupId: string): Promise<Result> {
  const session = await requireOwner();
  if (!z.guid().safeParse(groupId).success) return { ok: false, error: "Grupo inválido." };

  if (!reembolsoHabilitado()) {
    return {
      ok: false,
      error: "El reembolso todavía no está habilitado. Falta validarlo con MercadoPago.",
    };
  }

  const supabase = await createSupabaseServer();
  const { data: legs } = await supabase
    .from("payment_intents")
    .select("id, mp_order_id")
    .eq("store_id", session.store.id)
    .eq("split_group_id", groupId)
    .eq("status", "approved")
    .is("sale_id", null);

  if (!legs || legs.length === 0) {
    return { ok: false, error: "No hay ninguna parte cobrada para reembolsar en esa venta." };
  }

  const auth = await getStoreMpAuth(session.store.id);
  if (!auth) return { ok: false, error: "El negocio no tiene MercadoPago conectado." };

  // Secuencial y resumible: si una falla, cortamos; lo ya reembolsado queda asentado y
  // reintentar retoma desde la pata que falta (el idempotency-key evita doble devolución).
  for (const leg of legs) {
    if (!leg.mp_order_id) {
      return { ok: false, error: "Una parte no tiene orden de MercadoPago; reembolsala desde tu cuenta." };
    }
    const r = await mpReembolsarOrden(auth.token, String(leg.mp_order_id), `refund-${leg.id}`);
    if (!r.ok) return { ok: false, error: `No se pudo reembolsar en MercadoPago: ${r.error}` };
    await supabase.rpc("marcar_pata_reembolsada", {
      p_store_id: session.store.id,
      p_intent_id: leg.id,
    });
  }

  revalidatePath("/admin/caja");
  return { ok: true };
}
