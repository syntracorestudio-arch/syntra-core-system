"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { requireSuperadmin } from "@/lib/superadmin";
import { createAdminClient } from "@/lib/supabase/admin";

function back(params: Record<string, string>): never {
  redirect(`/super?${new URLSearchParams(params).toString()}`);
}

function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

const CreateSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    slug: z
      .string()
      .trim()
      .regex(/^[a-z0-9-]*$/)
      .max(60)
      .optional()
      .or(z.literal("")),
    timezone: z.string().trim().min(3).max(60),
    accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    admin_name: z.string().trim().max(80).optional().or(z.literal("")),
    admin_email: z.string().trim().email().optional().or(z.literal("")),
    admin_password: z.string().min(8).max(72).optional().or(z.literal("")),
  })
  .refine((v) => !v.admin_email || (v.admin_name && v.admin_password), {
    message: "admin_fields",
    path: ["admin_email"],
  });

/** Alta de estudio (+ dueño admin opcional) en un paso. Solo superadmin; service-role. */
export async function createStudio(formData: FormData) {
  await requireSuperadmin();

  const parsed = CreateSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    timezone: formData.get("timezone"),
    accent: formData.get("accent"),
    admin_name: formData.get("admin_name"),
    admin_email: formData.get("admin_email"),
    admin_password: formData.get("admin_password"),
  });
  if (!parsed.success) {
    const adminIssue = parsed.error.issues.some((i) => i.message === "admin_fields");
    back({
      error: adminIssue
        ? "Para crear el dueño completá nombre, email y clave temporal (mín. 8)."
        : "Revisá los datos del estudio.",
    });
  }
  const p = parsed.data;
  const slug = p.slug || slugify(p.name);
  if (!slug) back({ error: "No se pudo derivar un slug del nombre; escribilo a mano." });

  const admin = createAdminClient();

  // 1) Estudio + settings (defaults del producto).
  const { data: studio, error: stErr } = await admin
    .from("studios")
    .insert({ name: p.name, slug, timezone: p.timezone, branding: { accent: p.accent }, status: "active" })
    .select("id")
    .single();
  if (stErr || !studio) {
    back({ error: stErr?.code === "23505" ? `El slug “${slug}” ya existe.` : "No se pudo crear el estudio." });
  }
  const { error: setErr } = await admin.from("studio_settings").insert({ studio_id: studio.id });
  if (setErr) back({ error: "Estudio creado pero falló la config inicial. Revisá en Supabase." });

  // 2) Dueño/admin opcional: crea el usuario de Auth (o reusa si el email ya existe) + member admin.
  if (p.admin_email) {
    let uid: string | null = null;
    const { data: created, error: auErr } = await admin.auth.admin.createUser({
      email: p.admin_email,
      password: p.admin_password,
      email_confirm: true,
      user_metadata: { full_name: p.admin_name },
    });
    if (!auErr && created?.user) {
      uid = created.user.id;
    } else {
      // email ya registrado → vincular el perfil existente como admin del estudio nuevo
      const { data: prof } = await admin.from("profiles").select("id").eq("email", p.admin_email).maybeSingle();
      uid = (prof?.id as string) ?? null;
    }
    if (!uid) {
      back({
        error: `Estudio “${p.name}” creado, pero no se pudo crear el usuario del dueño. Probá desde Auth.`,
      });
    }
    const { error: memErr } = await admin
      .from("members")
      .insert({ studio_id: studio.id, profile_id: uid, role: "admin", status: "active" });
    if (memErr && memErr.code !== "23505") {
      back({ error: `Estudio “${p.name}” creado, pero falló el alta del admin.` });
    }
  }

  back({
    notice: p.admin_email
      ? `Estudio “${p.name}” creado con su dueño (${p.admin_email}). Pasale las credenciales.`
      : `Estudio “${p.name}” creado. Podés sumarle un dueño cuando quieras.`,
  });
}

/** Suspende / reactiva un estudio. */
export async function toggleStudioStatus(formData: FormData) {
  await requireSuperadmin();
  const id = String(formData.get("studioId") ?? "");
  const next = String(formData.get("next") ?? "");
  if (!id || !["active", "suspended"].includes(next)) back({ error: "Acción inválida." });

  const admin = createAdminClient();
  const { error } = await admin.from("studios").update({ status: next }).eq("id", id);
  back(
    error
      ? { error: "No se pudo actualizar el estado." }
      : { notice: next === "active" ? "Estudio reactivado." : "Estudio suspendido." },
  );
}
