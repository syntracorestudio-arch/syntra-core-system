"use server";

import { revalidatePath } from "next/cache";

import { updateLeadStatusSchema } from "@/lib/validations/lead";
import { updateLeadStatus } from "@/services/lead-service";
import { hasPanelSession } from "@/lib/auth/require-panel-session";

/**
 * Server Action de cambio de status (form action).
 * Valida en el servidor (Zod) y revalida el panel. Sin client state.
 *
 * AUTHZ propia (no delegada al proxy): esta action MUTA la DB y las Server
 * Actions se despachan por action-id, no por URL ⇒ el matcher de `proxy.ts`
 * no las cubre. Ver `lib/auth/require-panel-session.ts`.
 */
export async function updateLeadStatusAction(formData: FormData): Promise<void> {
  if (!(await hasPanelSession())) return;

  const parsed = updateLeadStatusSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
  });

  if (!parsed.success) {
    // Entrada inválida (manipulada): no hacemos nada.
    return;
  }

  await updateLeadStatus(parsed.data.id, parsed.data.status);
  revalidatePath("/panel");
  revalidatePath(`/panel/${parsed.data.id}`);
}
