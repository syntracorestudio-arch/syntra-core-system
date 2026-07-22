"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptSecret, encryptionReady } from "@/lib/crypto/secret";
import { mpQuienEs, mpAsegurarCaja } from "@/lib/mercadopago";

/**
 * Conexión de la cuenta de MercadoPago del negocio.
 *
 * SYNTRA no intermedia fondos: el token es del kiosquero, la plata le entra a él
 * y nosotros solo pedimos el QR con el monto. Por eso el token se guarda cifrado
 * y jamás vuelve al navegador — ni siquiera al del dueño.
 */

export type EstadoMp = {
  conectado: boolean;
  nickname: string | null;
  cajaLista: boolean;
  tieneFirma: boolean;
  cifradoListo: boolean;
  urlWebhook: string | null;
};

export type MpResult = { ok: true; mensaje: string } | { ok: false; error: string };

function urlWebhook(storeId: string): string | null {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (!base) return null;
  return `${base}/api/webhooks/mercadopago?store=${storeId}`;
}

/** Estado para la UI. Devuelve solo lo no-secreto: nunca el token. */
export async function estadoMercadoPago(): Promise<EstadoMp> {
  const session = await requireOwner();
  const admin = createAdminClient();

  const { data } = await admin
    .from("store_payment_providers")
    .select("status, mp_nickname, external_pos_id, webhook_secret")
    .eq("store_id", session.store.id)
    .maybeSingle();

  return {
    conectado: data?.status === "connected",
    nickname: (data?.mp_nickname as string | null) ?? null,
    cajaLista: Boolean(data?.external_pos_id),
    tieneFirma: Boolean(data?.webhook_secret),
    cifradoListo: encryptionReady(),
    urlWebhook: urlWebhook(session.store.id),
  };
}

const conectarSchema = z.object({
  accessToken: z.string().trim().min(20, "Ese token es muy corto. Copialo completo."),
});

export async function conectarMercadoPago(input: unknown): Promise<MpResult> {
  const session = await requireOwner();

  if (!encryptionReady()) {
    return {
      ok: false,
      error: "Falta configurar MP_ENC_KEY en el servidor. Sin eso no guardamos credenciales.",
    };
  }

  const parsed = conectarSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisá el token." };
  }
  const token = parsed.data.accessToken;

  // 1. ¿El token sirve y de quién es? Esto también evita guardar basura cifrada.
  const quien = await mpQuienEs(token);
  if (!quien.ok) {
    return {
      ok: false,
      error:
        quien.status === 401
          ? "MercadoPago rechazó ese token. Fijate que sea el Access Token de producción de tu aplicación."
          : `MercadoPago no respondió: ${quien.message}`.trim(),
    };
  }
  const mpUserId = String(quien.data.id);

  // 2. Sucursal + caja en SU cuenta, con SU token. Sin caja no hay QR posible.
  const caja = await mpAsegurarCaja(token, mpUserId, session.store.id, session.store.name);

  const admin = createAdminClient();
  const { error } = await admin.from("store_payment_providers").upsert(
    {
      store_id: session.store.id,
      provider: "mercadopago",
      status: "connected",
      access_token: encryptSecret(token),
      mp_user_id: mpUserId,
      mp_nickname: quien.data.nickname ?? null,
      external_store_id: caja.ok ? caja.externalStoreId : null,
      external_pos_id: caja.ok ? caja.externalPosId : null,
      mp_pos_id: caja.ok ? caja.posId : null,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "store_id" },
  );

  if (error) return { ok: false, error: "No pudimos guardar la conexión." };

  revalidatePath("/admin/configuracion");

  // La cuenta quedó conectada aunque la caja falle: el token es válido y el dueño
  // ve el problema real en lugar de un "error" que le esconde lo que sí funcionó.
  if (!caja.ok) {
    return {
      ok: false,
      error: `Tu cuenta quedó conectada, pero no pudimos crear la caja: ${caja.error}`,
    };
  }
  return { ok: true, mensaje: `Conectado como ${quien.data.nickname ?? mpUserId}.` };
}

const firmaSchema = z.object({ secret: z.string().trim().min(8, "Esa clave es muy corta.") });

/**
 * Clave de firma del webhook. Es opcional pero recomendada: con ella verificamos
 * que la notificación de "te pagaron" vino de MercadoPago y no de cualquiera.
 */
export async function guardarFirmaWebhook(input: unknown): Promise<MpResult> {
  const session = await requireOwner();
  if (!encryptionReady()) return { ok: false, error: "Falta MP_ENC_KEY en el servidor." };

  const parsed = firmaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisá la clave." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("store_payment_providers")
    .update({ webhook_secret: encryptSecret(parsed.data.secret) })
    .eq("store_id", session.store.id);

  if (error) return { ok: false, error: "No pudimos guardar la clave." };
  revalidatePath("/admin/configuracion");
  return { ok: true, mensaje: "Clave de firma guardada." };
}

export async function desconectarMercadoPago(): Promise<MpResult> {
  const session = await requireOwner();
  const admin = createAdminClient();

  // Borramos, no marcamos: si el dueño desconecta, su token no tiene por qué
  // seguir existiendo en nuestra base.
  const { error } = await admin
    .from("store_payment_providers")
    .delete()
    .eq("store_id", session.store.id);

  if (error) return { ok: false, error: "No pudimos desconectar la cuenta." };
  revalidatePath("/admin/configuracion");
  return { ok: true, mensaje: "Cuenta desconectada. El cobro con QR queda apagado." };
}
