"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function back(params: Record<string, string>): never {
  redirect(`/admin/configuracion?${new URLSearchParams(params).toString()}`);
}

const LOGO_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/svg+xml": "svg",
  "image/webp": "webp",
};
const LOGO_MAX = 2_097_152; // 2 MB

async function adminStudioBranding() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: member } = await supabase
    .from("members")
    .select("role, studio_id, studios(branding)")
    .limit(1)
    .maybeSingle();
  if (!member || member.role !== "admin") back({ error: "Solo el dueño puede editar la configuración." });
  const rel = member!.studios as { branding: Record<string, unknown> | null } | { branding: Record<string, unknown> | null }[] | null;
  const branding = (Array.isArray(rel) ? rel[0] : rel)?.branding ?? {};
  return { supabase, studioId: member!.studio_id as string, branding };
}

export async function uploadLogo(formData: FormData) {
  const { supabase, studioId, branding } = await adminStudioBranding();
  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) back({ error: "Elegí un archivo de logo." });
  const f = file as File;
  const ext = LOGO_TYPES[f.type];
  if (!ext) back({ error: "Formato no permitido. Usá PNG, JPG, SVG o WEBP." });
  if (f.size > LOGO_MAX) back({ error: "El logo debe pesar menos de 2 MB." });

  const path = `${studioId}.${ext}`;
  const admin = createAdminClient();
  const { error: upErr } = await admin.storage
    .from("studio-logos")
    .upload(path, f, { upsert: true, contentType: f.type });
  if (upErr) back({ error: "No se pudo subir el logo." });

  const { data: pub } = admin.storage.from("studio-logos").getPublicUrl(path);
  const logoUrl = `${pub.publicUrl}?v=${Date.now()}`; // cache-bust al reemplazar
  const { error: dbErr } = await supabase
    .from("studios")
    .update({ branding: { ...branding, logo_url: logoUrl, logo_path: path } })
    .eq("id", studioId);
  if (dbErr) back({ error: "No se pudo guardar el logo." });
  back({ notice: "Logo actualizado." });
}

export async function removeLogo() {
  const { supabase, studioId, branding } = await adminStudioBranding();
  const path = typeof branding.logo_path === "string" ? branding.logo_path : null;
  if (path) {
    const admin = createAdminClient();
    await admin.storage.from("studio-logos").remove([path]);
  }
  const next = { ...branding };
  delete next.logo_url;
  delete next.logo_path;
  const { error } = await supabase.from("studios").update({ branding: next }).eq("id", studioId);
  back(error ? { error: "No se pudo quitar el logo." } : { notice: "Logo quitado." });
}

const Schema = z.object({
  name: z.string().trim().min(1).max(80),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/, "color inválido"),
  timezone: z.string().trim().min(3).max(64),
  cancellation_window_hours: z.coerce.number().int().min(0).max(336),
  reservation_policy: z.enum([
    "require_credit_or_membership",
    "allow_with_warning",
    "allow_grace_n",
    "block_if_debt",
  ]),
  grace_n: z.coerce.number().int().min(0).max(20),
  default_capacity: z.coerce.number().int().min(1).max(200),
  expiry_warning_days: z.coerce.number().int().min(0).max(90),
  // landing pública (branding)
  subtitle: z.string().trim().max(120).optional().default(""),
  whatsapp: z.string().trim().max(30).optional().default(""),
  address: z.string().trim().max(160).optional().default(""),
  instagram: z.string().trim().max(80).optional().default(""),
});

export async function updateSettings(formData: FormData) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Solo admin (no reception) edita configuración sensible (coincide con RLS settings_write_admin).
  const { data: member } = await supabase
    .from("members")
    .select("role, studio_id, studios(branding)")
    .limit(1)
    .maybeSingle();
  if (!member || member.role !== "admin") back({ error: "Solo el dueño puede editar la configuración." });

  const parsed = Schema.safeParse({
    name: formData.get("name"),
    accent: formData.get("accent"),
    timezone: formData.get("timezone"),
    cancellation_window_hours: formData.get("cancellation_window_hours"),
    reservation_policy: formData.get("reservation_policy"),
    grace_n: formData.get("grace_n") || 0,
    default_capacity: formData.get("default_capacity"),
    expiry_warning_days: formData.get("expiry_warning_days"),
    subtitle: formData.get("subtitle") ?? "",
    whatsapp: formData.get("whatsapp") ?? "",
    address: formData.get("address") ?? "",
    instagram: formData.get("instagram") ?? "",
  });
  if (!parsed.success) back({ error: "Revisá los datos de la configuración." });
  const s = parsed.data;
  const refund = formData.get("refund_on_late_cancel") === "on";
  const waitlist = formData.get("waitlist_enabled") === "on";

  const studioRel = member!.studios as { branding: Record<string, unknown> | null } | { branding: Record<string, unknown> | null }[] | null;
  const branding = (Array.isArray(studioRel) ? studioRel[0] : studioRel)?.branding ?? {};

  const { error: e1 } = await supabase
    .from("studios")
    .update({
      name: s.name,
      timezone: s.timezone,
      branding: {
        ...branding,
        accent: s.accent,
        subtitle: s.subtitle,
        whatsapp: s.whatsapp,
        address: s.address,
        instagram: s.instagram,
      },
    })
    .eq("id", member!.studio_id);
  const { error: e2 } = await supabase
    .from("studio_settings")
    .update({
      cancellation_window_hours: s.cancellation_window_hours,
      reservation_policy: s.reservation_policy,
      grace_n: s.grace_n,
      refund_on_late_cancel: refund,
      default_capacity: s.default_capacity,
      waitlist_enabled: waitlist,
      expiry_warning_days: s.expiry_warning_days,
    })
    .eq("studio_id", member!.studio_id);

  if (e1 || e2) back({ error: "No se pudieron guardar los cambios." });
  back({ notice: "Configuración guardada." });
}
