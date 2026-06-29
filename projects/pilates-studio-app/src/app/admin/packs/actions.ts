"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";

const ADMIN_ROLES = ["admin", "reception"];

function back(params: Record<string, string>): never {
  redirect(`/admin/packs?${new URLSearchParams(params).toString()}`);
}

const Schema = z.object({
  name: z.string().trim().min(1).max(80),
  credits: z.coerce.number().int().min(1).max(500),
  validity_days: z.coerce.number().int().min(1).max(365),
  price: z.coerce.number().min(0).max(9_999_999),
});

async function adminStudio() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: member } = await supabase.from("members").select("role, studio_id").limit(1).maybeSingle();
  if (!member || !ADMIN_ROLES.includes(member.role)) redirect("/app");
  return { supabase, studioId: member.studio_id as string };
}

export async function createPass(formData: FormData) {
  const { supabase, studioId } = await adminStudio();
  const parsed = Schema.safeParse({
    name: formData.get("name"),
    credits: formData.get("credits"),
    validity_days: formData.get("validity_days"),
    price: formData.get("price"),
  });
  if (!parsed.success) back({ error: "Revisá los datos del pack." });
  const p = parsed.data;
  const { error } = await supabase.from("passes").insert({
    studio_id: studioId,
    name: p.name,
    credits: p.credits,
    validity_days: p.validity_days,
    price: p.price,
    active: true,
  });
  back(error ? { error: "No se pudo crear el pack." } : { notice: "Pack creado." });
}

export async function updatePass(formData: FormData) {
  const { supabase } = await adminStudio();
  const id = String(formData.get("passId") ?? "");
  if (!id) back({ error: "Falta el pack a editar." });
  const parsed = Schema.safeParse({
    name: formData.get("name"),
    credits: formData.get("credits"),
    validity_days: formData.get("validity_days"),
    price: formData.get("price"),
  });
  if (!parsed.success) back({ error: "Revisá los datos del pack." });
  const p = parsed.data;
  const { error } = await supabase
    .from("passes")
    .update({ name: p.name, credits: p.credits, validity_days: p.validity_days, price: p.price })
    .eq("id", id);
  back(error ? { error: "No se pudieron guardar los cambios." } : { notice: "Pack actualizado." });
}

export async function togglePass(formData: FormData) {
  const { supabase } = await adminStudio();
  const id = String(formData.get("passId") ?? "");
  const next = String(formData.get("active") ?? "") === "true";
  const { error } = await supabase.from("passes").update({ active: next }).eq("id", id);
  back(
    error
      ? { error: "No se pudo actualizar el pack." }
      : { notice: next ? "Pack activado." : "Pack desactivado." },
  );
}
