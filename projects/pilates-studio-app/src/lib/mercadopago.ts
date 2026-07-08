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

/** Cliente Preference de MP para un token dado (crea/lee preferencias de pago). */
export function mpPreference(token: string) {
  return new Preference(new MercadoPagoConfig({ accessToken: token }));
}
