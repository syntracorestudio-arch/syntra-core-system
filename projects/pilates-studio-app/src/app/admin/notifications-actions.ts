"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase/server";

/** Marca como leídas las notificaciones no leídas del estudio del actor.
 *  RLS (notifications_update_admin) limita a admin/recepción de su estudio. */
export async function markNotificationsRead() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
  revalidatePath("/admin", "layout");
}
