"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase/server";
import { requireOwner } from "@/lib/session";

export type Result = { ok: true } | { ok: false; error: string };

const settingsSchema = z.object({
  // Cotas con sentido de negocio, no arbitrarias: avisar con 90 días de
  // anticipación es ruido; con 0, el aviso llega tarde.
  expiry_warning_days: z.number().int().min(1, "Mínimo 1 día.").max(90, "Máximo 90 días."),
  low_stock_threshold_default: z.number().int().min(0).max(999),
  reprice_rounding: z.number().min(0).max(10000),
  allow_negative_stock: z.boolean(),
});

export async function updateSettings(input: unknown): Promise<Result> {
  const session = await requireOwner();
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisá los datos." };
  }

  const supabase = await createSupabaseServer();
  const { error } = await supabase
    .from("store_settings")
    .update(parsed.data)
    .eq("store_id", session.store.id);

  if (error) return { ok: false, error: "No pudimos guardar los ajustes." };

  // Los ajustes cambian lo que se ve en varias pantallas a la vez.
  revalidatePath("/admin/configuracion");
  revalidatePath("/admin/vencimientos");
  revalidatePath("/admin/productos");
  revalidatePath("/admin");
  return { ok: true };
}

/**
 * Cargar un vencimiento a mercadería que YA está en la góndola.
 *
 * El camino normal es cargarlo al recibir (ahí sabés qué lote entró), pero si el
 * kiosquero arranca con stock ya en el local no tenía forma de anotarlo — y sin
 * fecha no hay alerta posible.
 */
const expirySchema = z.object({
  product_id: z.guid(),
  expiry_date: z.string().min(8),
  qty: z.number().positive("Poné cuántas unidades vencen."),
});

export async function addExpiry(input: unknown): Promise<Result> {
  const session = await requireOwner();
  const parsed = expirySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisá los datos." };
  }

  const supabase = await createSupabaseServer();
  const { error } = await supabase.from("stock_expiries").insert({
    store_id: session.store.id,
    product_id: parsed.data.product_id,
    expiry_date: parsed.data.expiry_date,
    qty: parsed.data.qty,
    created_by: session.member.id,
    note: "carga manual",
  });

  if (error) return { ok: false, error: "No pudimos guardar el vencimiento." };

  revalidatePath("/admin/vencimientos");
  revalidatePath("/admin");
  return { ok: true };
}
