"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase/server";
import { requireSession } from "@/lib/session";
import { errorPromo } from "@/lib/promos";

/**
 * Acciones de Promociones.
 *
 * Nada de esto CALCULA un precio: el precio de promo lo resuelve el servidor
 * (migración 045) y las reglas de duración y piso de costo las hace cumplir
 * `create_promo` (047). Estas funciones sólo transportan y traducen errores —
 * si alguna vez alguien mete acá una cuenta de precios, la pantalla y la caja
 * van a discrepar.
 */

export type Result<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string };

const ISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "fecha inválida");

const crearSchema = z.object({
  productId: z.guid(),
  promoPrice: z.number().finite().nonnegative().max(99_999_999),
  startsOn: ISO,
  endsOn: ISO,
  expiryId: z.guid().nullable().optional(),
  origin: z.enum(["manual", "sugerida"]).default("manual"),
  belowCostOk: z.boolean().default(false),
  /** Segundo escalón: cierra la promo vigente y crea la nueva ATÓMICAMENTE. */
  reemplazar: z.boolean().default(false),
  /** 048 · promo de cantidad: tamaño del grupo. 1 = promo simple. */
  minQty: z.number().int().min(1).max(24).default(1),
});

/**
 * Poner una promo.
 *
 * El reemplazo va por `p_reemplazar` y no por "terminar + crear" desde el
 * cliente a propósito: dos llamadas dejan una ventana en la que la caja cobra
 * el precio de lista, y si la segunda falla la promo desaparece sin que nadie
 * lo haya pedido.
 */
export async function crearPromo(input: unknown): Promise<Result<{ promoId: string }>> {
  const session = await requireSession();
  const parsed = crearSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Faltan datos de la promo." };

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.rpc("create_promo", {
    p_store_id: session.store.id,
    p_product_id: parsed.data.productId,
    p_promo_price: parsed.data.promoPrice,
    p_starts_on: parsed.data.startsOn,
    p_ends_on: parsed.data.endsOn,
    p_expiry_id: parsed.data.expiryId ?? null,
    p_origin: parsed.data.origin,
    p_below_cost_ok: parsed.data.belowCostOk,
    p_reemplazar: parsed.data.reemplazar,
    p_min_qty: parsed.data.minQty,
  });

  if (error) return { ok: false, error: errorPromo(error.message) };

  revalidar();
  return { ok: true, data: { promoId: (data as { promo_id: string }).promo_id } };
}

/**
 * Terminar una promo antes de tiempo.
 *
 * Devuelve a cuánto vuelve el precio para que el aviso lo diga en pesos. Ese
 * número sale de `products.price` (el de HOY) y no del `list_price` congelado
 * al crear: si el dueño cambió el precio durante la promo, el congelado miente.
 */
export async function terminarPromo(promoId: string): Promise<Result<{ vuelveA: number }>> {
  const session = await requireSession();
  if (!z.guid().safeParse(promoId).success) {
    return { ok: false, error: "Esa promo ya no está." };
  }

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.rpc("end_promo", {
    p_store_id: session.store.id,
    p_promo_id: promoId,
  });

  if (error) return { ok: false, error: errorPromo(error.message) };

  revalidar();
  return { ok: true, data: { vuelveA: Number((data as { vuelve_a: string }).vuelve_a) } };
}

export type LoteDelProducto = { id: string; expiryDate: string; qty: number };

/**
 * Los lotes por vencer de un producto, para el alta manual.
 *
 * Acotado a 60 días y 10 filas: la ligadura sirve para lo que está cerca. Un
 * lote a dos años no es un motivo para rebajar nada.
 */
export async function lotesDelProducto(productId: string): Promise<LoteDelProducto[]> {
  await requireSession();
  if (!z.guid().safeParse(productId).success) return [];

  const supabase = await createSupabaseServer();
  const hasta = new Date();
  hasta.setDate(hasta.getDate() + 60);
  const p = (n: number) => String(n).padStart(2, "0");
  const hastaISO = `${hasta.getFullYear()}-${p(hasta.getMonth() + 1)}-${p(hasta.getDate())}`;

  const { data } = await supabase
    .from("stock_expiries")
    .select("id, expiry_date, qty")
    .eq("product_id", productId)
    .is("resolved_at", null)
    .lte("expiry_date", hastaISO)
    .order("expiry_date")
    .limit(10);

  return (data ?? []).map((e) => ({
    id: e.id as string,
    expiryDate: e.expiry_date as string,
    qty: Number(e.qty),
  }));
}

/** Una promo cambia el precio que cobra la caja: se revalida todo lo que lo muestra. */
function revalidar() {
  revalidatePath("/admin/promos");
  revalidatePath("/admin/promos/carteles");
  revalidatePath("/admin/vencimientos");
  revalidatePath("/pos");
  revalidatePath("/admin");
}
