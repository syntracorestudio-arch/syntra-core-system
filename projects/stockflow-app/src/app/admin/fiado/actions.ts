"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase/server";
import { requireSession, requireOwner } from "@/lib/session";

export type Result = { ok: true } | { ok: false; error: string };

const clientSchema = z.object({
  name: z.string().trim().min(1, "Poné el nombre.").max(80),
  phone: z.string().trim().max(40).nullable(),
  credit_limit: z.number().nonnegative().nullable(),
  note: z.string().trim().max(200).nullable(),
});

export async function createClient(input: unknown): Promise<Result> {
  const session = await requireSession();
  // Crear cliente lo puede hacer quien fía: si no, no podría abrir una cuenta
  // en el momento en que el vecino la necesita.
  if (!(session.member.role === "owner" || session.member.can_sell_on_credit)) {
    return { ok: false, error: "No tenés permiso para abrir cuentas." };
  }

  const parsed = clientSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisá los datos." };
  }

  const supabase = await createSupabaseServer();
  const { error } = await supabase
    .from("clients")
    .insert({ store_id: session.store.id, ...parsed.data });

  if (error) return { ok: false, error: "No pudimos guardar el cliente." };
  revalidatePath("/admin/fiado");
  revalidatePath("/pos");
  return { ok: true };
}

export async function updateClient(id: string, input: unknown): Promise<Result> {
  await requireOwner();
  const parsed = clientSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisá los datos." };
  }

  const supabase = await createSupabaseServer();
  const { error } = await supabase.from("clients").update(parsed.data).eq("id", id);

  if (error) return { ok: false, error: "No pudimos guardar los cambios." };
  revalidatePath("/admin/fiado");
  revalidatePath(`/admin/fiado/${id}`);
  revalidatePath("/pos");
  return { ok: true };
}

const paymentSchema = z.object({
  client_id: z.guid(),
  amount: z.number().positive("Poné cuánto te pagó."),
  payment_method: z.enum(["cash", "qr", "card", "transfer"]),
  note: z.string().trim().max(200).nullable().optional(),
});

/** Cobrar fiado. Pagos parciales permitidos: es lo normal en un almacén. */
export async function registerPayment(
  input: unknown,
): Promise<{ ok: true; balance: number; settled: boolean } | { ok: false; error: string }> {
  const session = await requireSession();
  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisá el monto." };
  }

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.rpc("register_client_payment", {
    p_store_id: session.store.id,
    p_client_id: parsed.data.client_id,
    p_amount: parsed.data.amount,
    p_payment_method: parsed.data.payment_method,
    p_note: parsed.data.note ?? null,
  });

  if (error) {
    if (error.message.includes("not_allowed")) {
      return { ok: false, error: "No tenés permiso para cobrar fiado." };
    }
    return { ok: false, error: "No pudimos registrar el pago." };
  }

  const result = data as { balance: number; settled: boolean };
  revalidatePath("/admin/fiado");
  revalidatePath(`/admin/fiado/${parsed.data.client_id}`);
  revalidatePath("/admin");
  return { ok: true, balance: Number(result.balance), settled: result.settled };
}

/** Ajuste manual del saldo (perdonar una deuda, corregir una carga). Solo owner. */
export async function adjustBalance(
  clientId: string,
  delta: number,
  note: string,
): Promise<Result> {
  const session = await requireOwner();
  if (!delta || Number.isNaN(delta)) return { ok: false, error: "Poné un monto." };
  if (!note.trim()) return { ok: false, error: "Escribí el motivo del ajuste." };

  const supabase = await createSupabaseServer();
  const { error } = await supabase.rpc("adjust_client_balance", {
    p_store_id: session.store.id,
    p_client_id: clientId,
    p_delta: delta,
    p_note: note,
  });

  if (error) return { ok: false, error: "No pudimos ajustar el saldo." };
  revalidatePath("/admin/fiado");
  revalidatePath(`/admin/fiado/${clientId}`);
  return { ok: true };
}
