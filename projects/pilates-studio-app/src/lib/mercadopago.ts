import { MercadoPagoConfig, Preference } from "mercadopago";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret } from "@/lib/crypto/secret";

/** Devuelve el Access Token descifrado del estudio si está conectado, o null. Server-only. */
export async function getStudioMpToken(studioId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("studio_payment_providers")
    .select("access_token, status")
    .eq("studio_id", studioId)
    .maybeSingle();
  if (!data || data.status !== "connected" || !data.access_token) return null;
  try {
    return decryptSecret(data.access_token as string);
  } catch {
    return null;
  }
}

/**
 * Devuelve token + clave de firma del webhook (ambos descifrados) para el estudio
 * conectado, o null. `webhookSecret` es null si el estudio no la configuró. Server-only.
 */
export async function getStudioMpAuth(
  studioId: string,
): Promise<{ token: string; webhookSecret: string | null } | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("studio_payment_providers")
    .select("access_token, webhook_secret, status")
    .eq("studio_id", studioId)
    .maybeSingle();
  if (!data || data.status !== "connected" || !data.access_token) return null;
  try {
    const token = decryptSecret(data.access_token as string);
    let webhookSecret: string | null = null;
    if (data.webhook_secret) {
      try {
        webhookSecret = decryptSecret(data.webhook_secret as string);
      } catch {
        webhookSecret = null; // secret ilegible → tratamos como no configurado
      }
    }
    return { token, webhookSecret };
  } catch {
    return null;
  }
}

/** Cliente Preference de MP para un token dado (crea/lee preferencias de pago). */
export function mpPreference(token: string) {
  return new Preference(new MercadoPagoConfig({ accessToken: token }));
}
