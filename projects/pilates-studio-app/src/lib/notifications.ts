import { createAdminClient } from "@/lib/supabase/admin";

export type NotificationType = "payment" | "debt" | "expiry" | "system";

/** Crea un aviso in-app para un estudio (server-side, service-role). Sin n8n, sin costo.
 *  Lo usa el webhook de pagos (Slice C) y cualquier flujo futuro (deuda, vencimientos). */
export async function createNotification(
  studioId: string,
  n: { type: NotificationType; title: string; body?: string; link?: string },
) {
  const admin = createAdminClient();
  await admin.from("notifications").insert({
    studio_id: studioId,
    type: n.type,
    title: n.title,
    body: n.body ?? null,
    link: n.link ?? null,
  });
}
