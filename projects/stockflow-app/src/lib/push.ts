import webpush from "web-push";
import { createAdminClient } from "./supabase/admin";

/**
 * Envío de Web Push. Server-only: la clave privada VAPID jamás toca el browser.
 *
 * Es lo que convierte a StockFlow en "un empleado que avisa" en vez de "un
 * sistema que hay que ir a mirar" — el diferencial que ningún competidor tiene.
 */

let configured = false;

function configure(): boolean {
  if (configured) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:syntracore.studio@gmail.com";
  if (!publicKey || !privateKey) return false;

  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

/**
 * Envía a todas las suscripciones de un negocio (o de un miembro puntual).
 * Devuelve cuántas llegaron.
 *
 * Limpieza: 404/410 significa que esa suscripción murió (el usuario desinstaló o
 * el navegador la rotó) → se borra. Si no, la tabla se llena de endpoints muertos
 * y cada envío tarda más.
 */
export async function sendPushToStore(
  storeId: string,
  payload: PushPayload,
  memberId?: string,
): Promise<{ sent: number; removed: number }> {
  if (!configure()) return { sent: 0, removed: 0 };

  const admin = createAdminClient();
  let query = admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("store_id", storeId);
  if (memberId) query = query.eq("member_id", memberId);

  const { data: subs } = await query;
  if (!subs || subs.length === 0) return { sent: 0, removed: 0 };

  let sent = 0;
  const dead: string[] = [];

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
          { urgency: "high", TTL: 60 * 60 * 12 },
        );
        sent++;
      } catch (err) {
        const code = (err as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) dead.push(s.id);
      }
    }),
  );

  if (dead.length > 0) {
    await admin.from("push_subscriptions").delete().in("id", dead);
  }

  return { sent, removed: dead.length };
}

/**
 * Notificación in-app + push, con dedupe.
 *
 * El `dedupe_key` es obligatorio para las alertas automáticas: sin él, el cron
 * diario le manda "te quedan 3 Coca" todos los días hasta que reponga, y el
 * dueño silencia la app. Un aviso repetido es peor que ningún aviso.
 */
export async function notifyStore(
  storeId: string,
  payload: PushPayload & { type: string; dedupeKey?: string; memberId?: string },
): Promise<boolean> {
  const admin = createAdminClient();

  const { error } = await admin.from("notifications").insert({
    store_id: storeId,
    member_id: payload.memberId ?? null,
    type: payload.type,
    title: payload.title,
    body: payload.body,
    url: payload.url ?? null,
    dedupe_key: payload.dedupeKey ?? null,
  });

  // Violación de unique = ya avisamos esto hoy. No es un error: es el dedupe
  // haciendo su trabajo. Cortamos acá y no mandamos el push.
  if (error) {
    if (error.code === "23505") return false;
    return false;
  }

  await sendPushToStore(storeId, payload, payload.memberId);
  return true;
}
