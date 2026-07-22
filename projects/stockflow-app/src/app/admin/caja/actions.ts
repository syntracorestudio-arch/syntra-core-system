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
