"use server";

import { createSupabaseServer } from "@/lib/supabase/server";

/**
 * Alta/baja de la suscripción Web Push del usuario logueado (RLS: solo la propia).
 * Un usuario puede tener varias suscripciones (teléfono + computadora).
 */
export async function savePushSubscription(input: {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
}): Promise<{ ok: boolean }> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { data: member } = await supabase
    .from("members")
    .select("id, studio_id")
    .eq("profile_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!member) return { ok: false };

  // upsert por endpoint (si el navegador re-suscribe, se pisa la fila anterior)
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      studio_id: member.studio_id,
      member_id: member.id,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      user_agent: (input.userAgent ?? "").slice(0, 200) || null,
    },
    { onConflict: "endpoint" },
  );
  return { ok: !error };
}

export async function removePushSubscription(endpoint: string): Promise<{ ok: boolean }> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };
  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  return { ok: !error };
}
