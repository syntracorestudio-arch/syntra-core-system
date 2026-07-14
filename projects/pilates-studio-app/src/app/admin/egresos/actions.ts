"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";

const EXPENSE_CATEGORIES = [
  "staff",
  "rent",
  "utilities",
  "equipment",
  "supplies",
  "marketing",
  "software",
  "other",
] as const;

function back(params: Record<string, string>): never {
  redirect(`/admin/egresos?${new URLSearchParams(params).toString()}`);
}

/** Solo el admin gestiona egresos (los sueldos del equipo son datos sensibles). */
async function adminStudio() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: member } = await supabase
    .from("members")
    .select("id, role, studio_id")
    .eq("profile_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!member) redirect("/app");
  if (member.role !== "admin") redirect("/admin");
  return { supabase, studioId: member.studio_id as string, meId: member.id as string };
}

const ExpenseSchema = z.object({
  category: z.enum(EXPENSE_CATEGORIES),
  amount: z.coerce.number().positive().max(99_999_999),
  method: z.enum(["cash", "transfer", "other"]),
  member_id: z.string().uuid().optional().or(z.literal("")),
  note: z.string().trim().max(200).optional().or(z.literal("")),
  paid_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
});

export async function createExpense(formData: FormData) {
  const { supabase, studioId, meId } = await adminStudio();
  const parsed = ExpenseSchema.safeParse({
    category: formData.get("category"),
    amount: formData.get("amount"),
    method: formData.get("method"),
    member_id: formData.get("member_id"),
    note: formData.get("note"),
    paid_on: formData.get("paid_on"),
    period_start: formData.get("period_start"),
    period_end: formData.get("period_end"),
  });
  if (!parsed.success) back({ error: "Revisá los datos del egreso." });
  const e = parsed.data;
  if (e.category === "staff" && !e.member_id) {
    back({ error: "Elegí a quién le pagaste (categoría sueldos)." });
  }

  const { error } = await supabase.from("expenses").insert({
    studio_id: studioId,
    category: e.category,
    amount: e.amount,
    method: e.method,
    member_id: e.category === "staff" ? e.member_id || null : null,
    note: e.note || null,
    paid_at: `${e.paid_on}T12:00:00Z`,
    period_start: e.period_start || null,
    period_end: e.period_end || null,
    recorded_by: meId,
  });
  back(error ? { error: "No se pudo registrar el egreso." } : { notice: "Egreso registrado." });
}

export async function deleteExpense(formData: FormData) {
  const { supabase } = await adminStudio();
  const id = String(formData.get("expenseId") ?? "");
  if (!id) back({ error: "Falta el egreso." });
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  back(error ? { error: "No se pudo borrar." } : { notice: "Egreso borrado." });
}

const RateSchema = z.object({
  member_id: z.string().uuid(),
  mode: z.enum(["per_class", "fixed_weekly", "fixed_monthly"]),
  amount: z.coerce.number().min(0).max(99_999_999),
});

/** Setea la tarifa vigente de un miembro (cierra la anterior → histórico gratis). */
export async function saveRate(formData: FormData) {
  const { supabase, studioId } = await adminStudio();
  const parsed = RateSchema.safeParse({
    member_id: formData.get("member_id"),
    mode: formData.get("mode"),
    amount: formData.get("amount"),
  });
  if (!parsed.success) back({ error: "Revisá la tarifa." });
  const r = parsed.data;

  // cerrar la tarifa vigente (si existe) y abrir la nueva
  await supabase
    .from("staff_rates")
    .update({ valid_to: new Date().toISOString().slice(0, 10) })
    .eq("member_id", r.member_id)
    .is("valid_to", null);
  const { error } = await supabase.from("staff_rates").insert({
    studio_id: studioId,
    member_id: r.member_id,
    mode: r.mode,
    amount: r.amount,
  });
  back(error ? { error: "No se pudo guardar la tarifa." } : { notice: "Tarifa guardada." });
}

/** Copia los egresos del mes anterior con fecha de hoy (sustituto barato de recurrencia). */
export async function repeatLastMonth(formData: FormData) {
  const { supabase, studioId, meId } = await adminStudio();
  const ym = String(formData.get("ym") ?? ""); // mes ACTUAL visible (YYYY-MM)
  if (!/^\d{4}-\d{2}$/.test(ym)) back({ error: "Período inválido." });
  const [y, m] = ym.split("-").map(Number);
  const prevYm = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;

  const { data: prev } = await supabase
    .from("expenses")
    .select("category, amount, method, member_id, note")
    .gte("paid_at", `${prevYm}-01T00:00:00Z`)
    .lt("paid_at", `${ym}-01T00:00:00Z`);
  if (!prev || prev.length === 0) back({ error: "No hay egresos del mes anterior para repetir." });

  const today = new Date().toISOString().slice(0, 10);
  const rows = prev.map((e) => ({
    studio_id: studioId,
    category: e.category,
    amount: e.amount,
    method: e.method,
    member_id: e.member_id,
    note: e.note ? `${e.note} (repetido)` : "repetido del mes anterior",
    paid_at: `${today}T12:00:00Z`,
    recorded_by: meId,
  }));
  const { error } = await supabase.from("expenses").insert(rows);
  back(
    error
      ? { error: "No se pudieron repetir los egresos." }
      : { notice: `${rows.length} ${rows.length === 1 ? "egreso repetido" : "egresos repetidos"} del mes anterior.` },
  );
}
