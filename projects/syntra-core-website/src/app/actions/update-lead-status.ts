"use server";

import { revalidatePath } from "next/cache";

import { updateLeadStatusSchema } from "@/lib/validations/lead";
import { updateLeadStatus } from "@/services/lead-service";

/**
 * Server Action de cambio de status (form action).
 * Valida en el servidor (Zod) y revalida el panel. Sin client state.
 */
export async function updateLeadStatusAction(formData: FormData): Promise<void> {
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
