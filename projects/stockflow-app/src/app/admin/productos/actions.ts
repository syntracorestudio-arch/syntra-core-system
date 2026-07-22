"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase/server";
import { requireOwner, requireSession } from "@/lib/session";

export type ActionResult = { ok: true } | { ok: false; error: string };

const productSchema = z.object({
  name: z.string().trim().min(1, "Poné un nombre.").max(80),
  price: z.number().nonnegative(),
  cost: z.number().nonnegative().nullable(),
  emoji: z.string().trim().max(8).nullable(),
  category_id: z.guid().nullable(),
  low_stock_threshold: z.number().int().nonnegative().nullable(),
});

export async function createProduct(input: unknown): Promise<ActionResult> {
  const session = await requireOwner();
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisá los datos." };
  }

  const supabase = await createSupabaseServer();
  const { error } = await supabase.from("products").insert({
    store_id: session.store.id,
    ...parsed.data,
    emoji: parsed.data.emoji || "📦",
  });

  if (error) return { ok: false, error: "No pudimos guardar el producto." };
  revalidatePath("/admin/productos");
  revalidatePath("/pos");
  return { ok: true };
}

export async function updateProduct(id: string, input: unknown): Promise<ActionResult> {
  await requireOwner();
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisá los datos." };
  }

  const supabase = await createSupabaseServer();
  // `stock` NO se toca acá: es un cache del ledger y sólo lo mueve el trigger.
  // Para corregirlo está `adjust_stock`, que deja el ajuste asentado.
  const { error } = await supabase
    .from("products")
    .update({ ...parsed.data, price_updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { ok: false, error: "No pudimos guardar los cambios." };
  revalidatePath("/admin/productos");
  revalidatePath("/pos");
  return { ok: true };
}

export async function archiveProduct(id: string): Promise<ActionResult> {
  await requireOwner();
  const supabase = await createSupabaseServer();
  // Archivar, nunca borrar: las ventas viejas tienen que seguir contando su historia.
  const { error } = await supabase.from("products").update({ status: "archived" }).eq("id", id);
  if (error) return { ok: false, error: "No pudimos archivar el producto." };
  revalidatePath("/admin/productos");
  revalidatePath("/pos");
  return { ok: true };
}

/** Ajuste manual de stock — pasa por RPC para que quede asentado en el ledger. */
export async function adjustStock(
  productId: string,
  delta: number,
  reason: "adjust" | "waste",
  note: string | null,
): Promise<ActionResult> {
  const session = await requireOwner();
  if (!delta || Number.isNaN(delta)) return { ok: false, error: "Poné una cantidad." };

  const supabase = await createSupabaseServer();
  const { error } = await supabase.rpc("adjust_stock", {
    p_store_id: session.store.id,
    p_product_id: productId,
    p_delta: delta,
    p_reason: reason,
    p_note: note,
  });

  if (error) {
    if (error.message.includes("invalid_delta")) {
      return { ok: false, error: "Una merma sólo puede restar." };
    }
    return { ok: false, error: "No pudimos ajustar el stock." };
  }
  revalidatePath("/admin/productos");
  revalidatePath("/pos");
  return { ok: true };
}

const repriceSchema = z.object({
  pct: z.number().refine((n) => n !== 0, "Poné un porcentaje distinto de cero."),
  category_id: z.guid().nullable(),
});

export async function bulkReprice(
  input: unknown,
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const session = await requireOwner();
  const parsed = repriceSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisá el porcentaje." };
  }

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.rpc("bulk_reprice", {
    p_store_id: session.store.id,
    p_pct: parsed.data.pct,
    p_category_id: parsed.data.category_id,
  });

  if (error) {
    if (error.message.includes("pct_out_of_range")) {
      return { ok: false, error: "Ese porcentaje es demasiado grande. Revisá el número." };
    }
    return { ok: false, error: "No pudimos remarcar." };
  }

  revalidatePath("/admin/productos");
  revalidatePath("/pos");
  return { ok: true, count: Number(data) };
}

/** Ingreso de mercadería — sube stock, pisa el costo y registra vencimientos. */
const purchaseSchema = z.object({
  items: z
    .array(
      z.object({
        product_id: z.guid(),
        qty: z.number().positive(),
        unit_cost: z.number().nonnegative().nullable(),
        expiry_date: z.string().nullable(),
      }),
    )
    .min(1, "Cargá al menos un producto."),
});

export async function registerPurchase(
  input: unknown,
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const session = await requireSession();
  if (!(session.member.role === "owner" || session.member.can_receive_stock)) {
    return { ok: false, error: "No tenés permiso para cargar mercadería." };
  }

  const parsed = purchaseSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisá la carga." };
  }

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.rpc("register_purchase", {
    p_store_id: session.store.id,
    p_items: parsed.data.items,
  });

  if (error) return { ok: false, error: "No pudimos registrar el ingreso." };

  revalidatePath("/admin/productos");
  revalidatePath("/admin/ingreso");
  revalidatePath("/pos");
  return { ok: true, count: Number(data) };
}
