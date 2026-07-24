"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase/server";
import { requireOwner } from "@/lib/session";
import { checkRateLimit } from "@/lib/rate-limit";

export type Result = { ok: true } | { ok: false; error: string };

/** Set cerrado de categorías — espejo del CHECK de la tabla `expenses` (018).
    La garantía anti-doble-conteo vive en la base; acá es la primera línea. */
const CATEGORIES = [
  "rent",
  "utilities",
  "salary",
  "taxes",
  "supplies",
  "maintenance",
  "other",
] as const;

const expenseSchema = z.object({
  category: z.enum(CATEGORIES),
  amount: z.number().positive("El monto tiene que ser mayor a cero."),
  incurred_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Elegí una fecha válida."),
  note: z.string().trim().max(200).nullable().optional(),
  is_recurring: z.boolean().optional(),
});

/**
 * Cargar un gasto operativo. Solo dueño (RLS owner-only + requireOwner + la RPC
 * valida `not_allowed`). Append-only: se inserta activo, nunca se edita.
 */
export async function registerExpenseAction(input: unknown): Promise<Result> {
  const session = await requireOwner();

  const parsed = expenseSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisá los datos." };
  }

  // Baseline: freno por negocio, fail-open (si el limiter se cae nunca bloqueamos
  // al dueño legítimo).
  if (!(await checkRateLimit(`expense:${session.store.id}`, 30, 60))) {
    return { ok: false, error: "Demasiadas cargas seguidas. Esperá unos segundos." };
  }

  const supabase = await createSupabaseServer();
  const { error } = await supabase.rpc("register_expense", {
    p_store_id: session.store.id,
    p_category: parsed.data.category,
    p_amount: parsed.data.amount,
    p_incurred_on: parsed.data.incurred_on,
    p_note: parsed.data.note?.trim() || null,
    p_is_recurring: parsed.data.is_recurring ?? false,
  });

  if (error) {
    if (error.message.includes("not_allowed")) {
      return { ok: false, error: "No tenés permiso para cargar gastos." };
    }
    if (error.message.includes("invalid_category")) {
      return { ok: false, error: "Esa categoría no existe." };
    }
    if (error.message.includes("invalid_amount")) {
      return { ok: false, error: "El monto tiene que ser mayor a cero." };
    }
    if (error.message.includes("invalid_date")) {
      return { ok: false, error: "Esa fecha no es válida." };
    }
    return { ok: false, error: "No pudimos guardar el gasto." };
  }

  revalidatePath("/admin/gastos");
  revalidatePath("/admin/reportes");
  revalidatePath("/admin");
  return { ok: true };
}

/**
 * Anular un gasto. Cambia el resultado de un período, así que la UI pide confirm.
 * La RPC es idempotente: doble tap = una sola anulación. Nunca borra.
 */
export async function voidExpenseAction(expenseId: string, motivo: string): Promise<Result> {
  const session = await requireOwner();

  const supabase = await createSupabaseServer();
  const { error } = await supabase.rpc("void_expense", {
    p_store_id: session.store.id,
    p_expense_id: expenseId,
    p_reason: motivo.trim() || null,
  });

  if (error) {
    if (error.message.includes("not_allowed")) {
      return { ok: false, error: "No tenés permiso para anular gastos." };
    }
    if (error.message.includes("expense_not_found")) {
      return { ok: false, error: "Ese gasto ya no existe." };
    }
    return { ok: false, error: "No pudimos anular el gasto." };
  }

  revalidatePath("/admin/gastos");
  revalidatePath("/admin/reportes");
  revalidatePath("/admin");
  return { ok: true };
}
