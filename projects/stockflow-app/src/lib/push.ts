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

/** Fallos seguidos antes de dar por muerta una suscripción. */
const MAX_FALLOS = 3;

/**
 * Envía a todas las suscripciones de un negocio (o de un miembro puntual).
 *
 * Sobre la limpieza: SOLO un 410 Gone es definitivo (el navegador dice "esta
 * suscripción ya no existe"). Antes acá se borraba también con 404 y al PRIMER
 * fallo, y eso destruía una suscripción recién creada ante cualquier error
 * transitorio — que es exactamente lo que pasó la primera vez que se probó en un
 * teléfono real. Para eso existe `failed_count`: se cuenta, y recién al tercer
 * fallo seguido se borra. Un envío exitoso resetea el contador.
 */
export async function sendPushToStore(
  storeId: string,
  payload: PushPayload,
  memberId?: string,
): Promise<{ sent: number; removed: number; errors: string[] }> {
  if (!configure()) {
    return { sent: 0, removed: 0, errors: ["VAPID no configurado"] };
  }

  const admin = createAdminClient();
  let query = admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth, failed_count")
    .eq("store_id", storeId);
  if (memberId) query = query.eq("member_id", memberId);

  const { data: subs } = await query;
  if (!subs || subs.length === 0) return { sent: 0, removed: 0, errors: [] };

  let sent = 0;
  const dead: string[] = [];
  const fallaron: { id: string; count: number }[] = [];
  const errors: string[] = [];

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
          { urgency: "high", TTL: 60 * 60 * 12 },
        );
        sent++;
        if (s.failed_count > 0) fallaron.push({ id: s.id, count: 0 });
      } catch (err) {
        const e = err as { statusCode?: number; body?: string; message?: string };
        const detalle = `${e.statusCode ?? "?"} ${e.body ?? e.message ?? ""}`.trim();
        errors.push(detalle);
        // Sin esto, un fallo de push es invisible: el usuario ve "activado" y
        // nunca le llega nada.
        console.error("[push] falló el envío:", detalle);

        if (e.statusCode === 410) {
          dead.push(s.id); // definitivo: el navegador la dio de baja
        } else {
          const nuevo = (s.failed_count ?? 0) + 1;
          if (nuevo >= MAX_FALLOS) dead.push(s.id);
          else fallaron.push({ id: s.id, count: nuevo });
        }
      }
    }),
  );

  for (const f of fallaron) {
    await admin
      .from("push_subscriptions")
      .update({ failed_count: f.count, last_seen_at: new Date().toISOString() })
      .eq("id", f.id);
  }

  if (dead.length > 0) {
    await admin.from("push_subscriptions").delete().in("id", dead);
  }

  return { sent, removed: dead.length, errors };
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
