"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSession } from "@/lib/session";

export type Result = { ok: true } | { ok: false; error: string };

/** Resolver un vencimiento: se vendió, o hubo que tirarlo. */
export async function resolveExpiry(
  expiryId: string,
  resolution: "sold" | "wasted",
  wasteQty?: number | null,
): Promise<Result> {
  const session = await requireSession();
  const supabase = await createSupabaseServer();

  const { error } = await supabase.rpc("resolve_expiry", {
    p_store_id: session.store.id,
    p_expiry_id: expiryId,
    p_resolution: resolution,
    p_waste_qty: wasteQty ?? null,
  });

  if (error) {
    if (error.message.includes("not_allowed")) {
      return { ok: false, error: "No tenés permiso para esto." };
    }
    return { ok: false, error: "No pudimos registrarlo." };
  }

  revalidatePath("/admin/vencimientos");
  revalidatePath("/admin");
  revalidatePath("/pos");
  return { ok: true };
}

/* -------------------------------------------------------------------------
   Suscripción a las notificaciones push.
   ------------------------------------------------------------------------- */

const subSchema = z.object({
  endpoint: z.string().url().max(1000),
  p256dh: z.string().min(10).max(255),
  auth: z.string().min(10).max(255),
});

export async function subscribeToPush(input: unknown): Promise<Result> {
  const session = await requireSession();
  const parsed = subSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Suscripción inválida." };

  // Admin client: el upsert por endpoint necesita ver filas de otros dispositivos
  // del mismo usuario para no duplicarlas.
  const admin = createAdminClient();
  const { error } = await admin.from("push_subscriptions").upsert(
    {
      store_id: session.store.id,
      member_id: session.member.id,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.p256dh,
      auth: parsed.data.auth,
      last_seen_at: new Date().toISOString(),
      failed_count: 0,
    },
    { onConflict: "endpoint" },
  );

  if (error) return { ok: false, error: "No pudimos activar los avisos." };
  return { ok: true };
}

export async function unsubscribeFromPush(endpoint: string): Promise<Result> {
  await requireSession();
  const admin = createAdminClient();
  await admin.from("push_subscriptions").delete().eq("endpoint", endpoint);
  return { ok: true };
}

/** Prueba: se manda a sí mismo un push para confirmar que llega al teléfono. */
export async function sendTestPush(): Promise<Result> {
  const session = await requireSession();
  const { sendPushToStore } = await import("@/lib/push");

  const { sent } = await sendPushToStore(
    session.store.id,
    {
      title: "Los avisos están activos",
      body: `Así te vamos a avisar cuando algo necesite tu atención en ${session.store.name}.`,
      url: "/admin",
      tag: "test",
    },
    session.member.id,
  );

  if (sent === 0) {
    return { ok: false, error: "No llegó. Revisá los permisos de notificaciones." };
  }
  return { ok: true };
}
