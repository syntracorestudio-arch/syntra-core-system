import { NextResponse } from "next/server";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Despacho de Web Push. Lo invoca el Database Webhook de Supabase en cada INSERT
 * en public.notifications:
 *   - notificación con member_id → burbuja a los equipos de ESE usuario;
 *   - notificación del panel (member_id null) → a admin/recepción del estudio.
 * Autenticación: header x-push-secret (PUSH_WEBHOOK_SECRET). Las suscripciones
 * vencidas (404/410) se limpian solas.
 */
export async function POST(req: Request) {
  const secret = process.env.PUSH_WEBHOOK_SECRET;
  if (!secret || req.headers.get("x-push-secret") !== secret) {
    return new NextResponse("forbidden", { status: 403 });
  }
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return new NextResponse("push not configured", { status: 500 });
  webpush.setVapidDetails("mailto:syntracore.studio@gmail.com", publicKey, privateKey);

  type NotifRecord = {
    id?: string;
    studio_id?: string;
    member_id?: string | null;
    title?: string;
    body?: string | null;
    link?: string | null;
  };
  let record: NotifRecord | null = null;
  try {
    const payload = (await req.json()) as { type?: string; record?: NotifRecord | null };
    if (payload.type && payload.type !== "INSERT") return NextResponse.json({ sent: 0, skipped: "not-insert" });
    record = payload.record ?? null;
  } catch {
    return new NextResponse("bad payload", { status: 400 });
  }
  if (!record?.studio_id || !record.title) return new NextResponse("bad record", { status: 400 });

  const db = createAdminClient();

  // destinatarios: el member puntual, o el staff del estudio (avisos del panel)
  let memberIds: string[] = [];
  if (record.member_id) {
    memberIds = [record.member_id];
  } else {
    const { data: staff } = await db
      .from("members")
      .select("id")
      .eq("studio_id", record.studio_id)
      .in("role", ["admin", "reception"])
      .eq("status", "active");
    memberIds = (staff ?? []).map((m) => m.id as string);
  }
  if (memberIds.length === 0) return NextResponse.json({ sent: 0 });

  const { data: subs } = await db
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .in("member_id", memberIds);
  if (!subs || subs.length === 0) return NextResponse.json({ sent: 0 });

  const message = JSON.stringify({
    title: record.title,
    body: record.body ?? "",
    link: record.link ?? (record.member_id ? "/app" : "/admin"),
    tag: record.id ?? undefined,
  });

  let sent = 0;
  const gone: string[] = [];
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          message,
        );
        sent += 1;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) gone.push(s.endpoint);
      }
    }),
  );
  if (gone.length > 0) await db.from("push_subscriptions").delete().in("endpoint", gone);

  return NextResponse.json({ sent, cleaned: gone.length });
}
