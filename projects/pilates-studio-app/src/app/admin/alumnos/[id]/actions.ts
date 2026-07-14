"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";

const ADMIN_ROLES = ["admin", "reception"];

// UUID laxo (sin exigir nibble de versión/variante RFC; el seed usa ids no-conformantes
// y Postgres valida el cast de uuid igualmente).
const UUID = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

const Schema = z.object({
  memberId: UUID,
  concept: z.enum(["pack", "drop_in", "membership", "abono"]),
  method: z.enum(["cash", "transfer", "card_manual"]),
  amount: z.coerce.number().nonnegative().max(9_999_999),
  pass_id: UUID.optional(),
  membership_days: z.coerce.number().int().positive().max(365).optional(),
});

export async function registerPayment(formData: FormData) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: member } = await supabase
    .from("members")
    .select("role")
    .eq("profile_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!member || !ADMIN_ROLES.includes(member.role)) redirect("/app");

  const parsed = Schema.safeParse({
    memberId: formData.get("memberId"),
    concept: formData.get("concept"),
    method: formData.get("method"),
    amount: formData.get("amount"),
    pass_id: formData.get("pass_id") || undefined,
    membership_days: formData.get("membership_days") || undefined,
  });

  const memberId = String(formData.get("memberId") ?? "");
  const back = (params: Record<string, string>): never => {
    // refresca el widget del sidebar ("Cobrado hoy") sin recarga completa
    revalidatePath("/admin", "layout");
    redirect(`/admin/alumnos/${memberId}?${new URLSearchParams(params).toString()}`);
  };

  if (!parsed.success) return back({ error: "Revisá los datos del pago." });
  const p = parsed.data;

  if (p.concept === "pack" && !p.pass_id) return back({ error: "Elegí un pack." });
  if ((p.concept === "membership" || p.concept === "abono") && !p.membership_days) {
    return back({ error: "Indicá los días de acceso." });
  }

  const { error } = await supabase.rpc("apply_payment", {
    p_member_id: p.memberId,
    p_concept: p.concept,
    p_method: p.method,
    p_amount: p.amount,
    p_pass_id: p.pass_id ?? null,
    p_membership_type: null,
    p_membership_days: p.membership_days ?? null,
  });

  if (error) {
    const msg = error.message.includes("forbidden")
      ? "No autorizado."
      : error.message.includes("pass_not_found")
        ? "El pack no existe o está inactivo."
        : "No se pudo registrar el pago.";
    back({ error: msg });
  }
  back({ notice: "Pago registrado. Saldo actualizado." });
}

const ROLE_NOTICE: Record<string, string> = {
  client: "Vuelve a ser alumno.",
  instructor: "Ahora es instructor.",
  reception: "Ahora es recepción.",
};

/**
 * Cambia el rol de un member entre 'client', 'instructor' y 'reception' (solo admin).
 * Restringido a esos tres valores a propósito: este control NUNCA puede escalar a
 * 'admin' (evita escalada de privilegios desde la ficha).
 * La escritura va por RLS (members_write_admin, mismo estudio).
 */
export async function setMemberRole(formData: FormData) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Solo admin gestiona roles de staff.
  const { data: me } = await supabase
    .from("members")
    .select("role")
    .eq("profile_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!me || me.role !== "admin") redirect("/app");

  const memberId = String(formData.get("memberId") ?? "");
  const role = String(formData.get("role") ?? "");
  const back = (params: Record<string, string>): never =>
    redirect(`/admin/alumnos/${memberId}?${new URLSearchParams(params).toString()}`);

  const parsed = z
    .object({ memberId: UUID, role: z.enum(["client", "instructor", "reception"]) })
    .safeParse({ memberId, role });
  if (!parsed.success) return back({ error: "Datos inválidos." });

  const { error } = await supabase
    .from("members")
    .update({ role: parsed.data.role })
    .eq("id", parsed.data.memberId);
  if (error) return back({ error: "No se pudo actualizar el rol." });

  back({ notice: ROLE_NOTICE[parsed.data.role] ?? "Rol actualizado." });
}

/** Guarda la nota operativa del alumno (lesiones, acuerdos; la ve el staff). */
export async function updateMemberNotes(formData: FormData) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("members")
    .select("role")
    .eq("profile_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!me || !ADMIN_ROLES.includes(me.role)) redirect("/app");

  const memberId = String(formData.get("memberId") ?? "");
  const notes = String(formData.get("notes") ?? "").trim().slice(0, 500);
  const back = (params: Record<string, string>): never =>
    redirect(`/admin/alumnos/${memberId}?${new URLSearchParams(params).toString()}`);

  const { error } = await supabase
    .from("members")
    .update({ notes: notes || null })
    .eq("id", memberId);
  back(error ? { error: "No se pudo guardar la nota." } : { notice: notes ? "Nota guardada." : "Nota eliminada." });
}
