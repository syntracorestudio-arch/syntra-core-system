"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase/server";
import { requireOwner } from "@/lib/session";

export type Result = { ok: true } | { ok: false; error: string };

const ERRORS: Record<string, string> = {
  not_allowed: "No tenés permiso para cambiar precios.",
  product_not_found: "Ese producto ya no existe.",
  invalid_amount: "Revisá el precio.",
  price_too_high: "Ese precio es más de 5 veces el actual. Revisalo.",
};

/** Remarca un producto al precio sugerido (o al que el dueño escriba). */
export async function aplicarPrecio(productId: string, precio: number): Promise<Result> {
  const session = await requireOwner();

  if (!z.guid().safeParse(productId).success || !Number.isFinite(precio) || precio <= 0) {
    return { ok: false, error: "Revisá el precio." };
  }

  const supabase = await createSupabaseServer();
  const { error } = await supabase.rpc("aplicar_precio", {
    p_store_id: session.store.id,
    p_product_id: productId,
    p_precio: precio,
  });

  if (error) {
    for (const [code, text] of Object.entries(ERRORS)) {
      if (error.message.includes(code)) return { ok: false, error: text };
    }
    return { ok: false, error: "No pudimos cambiar el precio." };
  }

  revalidatePath("/admin/precios");
  revalidatePath("/admin/productos");
  revalidatePath("/pos");
  return { ok: true };
}
