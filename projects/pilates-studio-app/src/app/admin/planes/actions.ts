"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";

function back(params: Record<string, string>): never {
  redirect(`/admin/planes?${new URLSearchParams(params).toString()}`);
}

const Schema = z
  .object({
    name: z.string().trim().min(1).max(80),
    concept: z.enum(["membership", "abono", "drop_in"]),
    price: z.coerce.number().min(0).max(9_999_999),
    duration_days: z.coerce.number().int().min(1).max(365).optional(),
  })
  .refine((v) => v.concept === "drop_in" || v.duration_days != null, {
    message: "duration_required",
    path: ["duration_days"],
  });

async function adminStudio() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: member } = await supabase
    .from("members")
    .select("role, studio_id")
    .eq("profile_id", user.id)
    .limit(1)
    .maybeSingle();
  // Precios/catálogo = decisión del dueño → solo admin.
  if (!member) redirect("/app");
  if (member.role !== "admin") redirect("/admin");
  return { supabase, studioId: member.studio_id as string };
}

function parse(formData: FormData) {
  return Schema.safeParse({
    name: formData.get("name"),
    concept: formData.get("concept"),
    price: formData.get("price"),
    duration_days: formData.get("duration_days") || undefined,
  });
}

export async function createPlan(formData: FormData) {
  const { supabase, studioId } = await adminStudio();
  const parsed = parse(formData);
  if (!parsed.success) back({ error: "Revisá los datos del plan." });
  const p = parsed.data;
  const { error } = await supabase.from("sale_products").insert({
    studio_id: studioId,
    name: p.name,
    concept: p.concept,
    price: p.price,
    duration_days: p.concept === "drop_in" ? null : p.duration_days,
    active: true,
  });
  back(error ? { error: "No se pudo crear el plan." } : { notice: "Plan creado." });
}

export async function updatePlan(formData: FormData) {
  const { supabase } = await adminStudio();
  const id = String(formData.get("planId") ?? "");
  if (!id) back({ error: "Falta el plan a editar." });
  const parsed = parse(formData);
  if (!parsed.success) back({ error: "Revisá los datos del plan." });
  const p = parsed.data;
  const { error } = await supabase
    .from("sale_products")
    .update({
      name: p.name,
      concept: p.concept,
      price: p.price,
      duration_days: p.concept === "drop_in" ? null : p.duration_days,
    })
    .eq("id", id);
  back(error ? { error: "No se pudieron guardar los cambios." } : { notice: "Plan actualizado." });
}

export async function togglePlan(formData: FormData) {
  const { supabase } = await adminStudio();
  const id = String(formData.get("planId") ?? "");
  const next = String(formData.get("active") ?? "") === "true";
  const { error } = await supabase.from("sale_products").update({ active: next }).eq("id", id);
  back(
    error
      ? { error: "No se pudo actualizar el plan." }
      : { notice: next ? "Plan activado." : "Plan desactivado." },
  );
}
