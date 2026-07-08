"use server";

import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptSecret } from "@/lib/crypto/secret";

/** Solo admin gestiona la conexión de cobro. Devuelve el studio_id del actor. */
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
  if (!member || member.role !== "admin") redirect("/admin");
  return { studioId: member.studio_id as string };
}

function back(params: Record<string, string>): never {
  redirect(`/admin/configuracion?${new URLSearchParams(params).toString()}`);
}

/** Conecta MercadoPago: valida el Access Token contra la API de MP, lo cifra y guarda. */
export async function connectMercadoPago(formData: FormData) {
  const { studioId } = await adminStudio();
  const token = String(formData.get("access_token") ?? "").trim();
  if (!token) return back({ error: "Pegá tu Access Token de MercadoPago." });

  // Validar el token contra MP (identifica la cuenta receptora).
  let mpUserId: string | null = null;
  let nickname: string | null = null;
  try {
    const r = await fetch("https://api.mercadopago.com/users/me", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!r.ok) return back({ error: "El Access Token no es válido o no tiene permisos." });
    const u = (await r.json()) as { id?: number | string; nickname?: string };
    mpUserId = u.id != null ? String(u.id) : null;
    nickname = u.nickname ?? null;
  } catch {
    return back({ error: "No se pudo validar el token con MercadoPago. Reintentá." });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("studio_payment_providers").upsert(
    {
      studio_id: studioId,
      provider: "mercadopago",
      status: "connected",
      access_token: encryptSecret(token),
      mp_user_id: mpUserId,
      mp_nickname: nickname,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "studio_id" },
  );
  if (error) return back({ error: "No se pudo guardar la conexión." });
  back({ notice: nickname ? `MercadoPago conectado (${nickname}).` : "MercadoPago conectado." });
}

/** Desconecta MercadoPago (borra la credencial del estudio). */
export async function disconnectMercadoPago() {
  const { studioId } = await adminStudio();
  const admin = createAdminClient();
  await admin.from("studio_payment_providers").delete().eq("studio_id", studioId);
  back({ notice: "MercadoPago desconectado." });
}
