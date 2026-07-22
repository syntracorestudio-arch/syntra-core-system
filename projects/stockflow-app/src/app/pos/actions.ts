"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase/server";
import { requireSession } from "@/lib/session";

/**
 * Cobro. Toda la lógica pesada (atomicidad, stock, fiado, idempotencia) vive en
 * la RPC `register_sale`: acá solo validamos la forma y traducimos el error a
 * castellano. Nunca escribimos ventas ni ledgers desde la app.
 */

/**
 * `z.guid()` y no `z.uuid()`: Zod 4 valida RFC-4122 estricto (bits de versión y
 * variante), y eso rechaza identificadores que Postgres acepta sin problema —
 * entre ellos los UUID legibles del seed (`d1000000-0000-…`). Acá queremos
 * validar la FORMA, no el linaje del UUID; la base es la autoridad del tipo.
 */
const itemSchema = z.object({
  product_id: z.guid().nullable(),
  qty: z.number().positive(),
  unit_price: z.number().nonnegative().nullable().optional(),
  free_amount: z.number().positive().nullable().optional(),
  name: z.string().max(80).nullable().optional(),
});

const saleSchema = z.object({
  items: z.array(itemSchema).min(1),
  payment_method: z.enum(["cash", "qr", "card", "transfer", "account"]),
  idempotency_key: z.string().min(8).max(64),
  client_id: z.guid().nullable().optional(),
});

export type SaleResult =
  | {
      ok: true;
      saleId: string;
      total: number;
      replayed: boolean;
      overLimit: boolean;
      negativeStock: { product_id: string; name: string; stock: number }[];
    }
  | { ok: false; error: string };

/** Errores de la RPC → castellano del mostrador. */
const ERRORS: Record<string, string> = {
  not_a_member: "Tu sesión no es válida. Volvé a entrar.",
  not_allowed: "No tenés permiso para esta acción.",
  empty_items: "La venta está vacía.",
  invalid_qty: "Revisá las cantidades.",
  invalid_amount: "Revisá el monto.",
  invalid_payment_method: "Elegí un medio de pago válido.",
  product_not_found: "Un producto ya no está disponible. Actualizá la caja.",
  product_archived: "Un producto fue dado de baja. Sacalo de la venta.",
  insufficient_stock: "No hay stock suficiente y tu negocio no permite vender en negativo.",
  client_required: "Elegí a quién le fiás.",
  client_not_found: "Ese cliente no existe.",
};

function translate(message: string): string {
  for (const [code, text] of Object.entries(ERRORS)) {
    if (message.includes(code)) return text;
  }
  return "No pudimos cobrar. Probá de nuevo.";
}

export async function registerSale(input: unknown): Promise<SaleResult> {
  const session = await requireSession();

  const parsed = saleSchema.safeParse(input);
  if (!parsed.success) {
    console.error("[registerSale] payload inválido:", JSON.stringify(parsed.error.issues));
    return { ok: false, error: "Datos de la venta inválidos." };
  }

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.rpc("register_sale", {
    p_store_id: session.store.id,
    p_items: parsed.data.items,
    p_payment_method: parsed.data.payment_method,
    p_idempotency_key: parsed.data.idempotency_key,
    p_client_id: parsed.data.client_id ?? null,
  });

  if (error) {
    return { ok: false, error: translate(error.message) };
  }

  const result = data as {
    sale_id: string;
    total: number;
    replayed: boolean;
    over_limit: boolean;
    negative_stock: { product_id: string; name: string; stock: number }[];
  };

  // El catálogo del POS y el panel del dueño muestran stock: quedaron viejos.
  revalidatePath("/pos");
  revalidatePath("/admin");

  return {
    ok: true,
    saleId: result.sale_id,
    total: Number(result.total),
    replayed: result.replayed,
    overLimit: result.over_limit,
    negativeStock: result.negative_stock ?? [],
  };
}

/** Alta rápida desde la caja: dos campos, menos de 10 segundos (PRD §4). */
const quickProductSchema = z.object({
  name: z.string().trim().min(1).max(80),
  price: z.number().nonnegative(),
  barcode: z.string().trim().max(64).nullable().optional(),
});

export async function quickCreateProduct(
  input: unknown,
): Promise<{ ok: true; id: string; name: string; price: number } | { ok: false; error: string }> {
  const session = await requireSession();

  if (!(session.member.role === "owner" || session.member.can_receive_stock)) {
    return { ok: false, error: "No tenés permiso para dar de alta productos." };
  }

  const parsed = quickProductSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Poné al menos nombre y precio." };
  }

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("products")
    .insert({
      store_id: session.store.id,
      name: parsed.data.name,
      price: parsed.data.price,
      emoji: "📦",
    })
    .select("id, name, price")
    .single();

  if (error || !data) {
    return { ok: false, error: "No pudimos guardar el producto." };
  }

  if (parsed.data.barcode) {
    await supabase.from("product_barcodes").insert({
      store_id: session.store.id,
      product_id: data.id,
      barcode: parsed.data.barcode,
    });
  }

  revalidatePath("/pos");
  return { ok: true, id: data.id, name: data.name, price: Number(data.price) };
}
