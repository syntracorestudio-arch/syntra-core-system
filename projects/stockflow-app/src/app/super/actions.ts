"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSuperadmin } from "@/lib/superadmin";

export type AltaResult =
  | { ok: true; store: string; email: string; password: string }
  | { ok: false; error: string };

const schema = z.object({
  name: z.string().trim().min(2, "Poné el nombre del negocio.").max(80),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, "La dirección va en minúsculas, sin espacios ni acentos."),
  ownerEmail: z.string().email("Revisá el email del dueño."),
  ownerName: z.string().trim().max(80).nullable(),
  accent: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "El color va en formato #2E6BFF.")
    .nullable(),
});

/** Contraseña temporal legible: se la dicta por teléfono al dueño. */
function passwordTemporal(): string {
  const palabras = ["kiosco", "gondola", "vuelto", "mostrador", "changuito", "fiambre"];
  const palabra = palabras[Math.floor(Math.random() * palabras.length)];
  const numero = Math.floor(1000 + Math.random() * 9000);
  return `${palabra}-${numero}`;
}

/**
 * Alta de un kiosco nuevo. Es un acto de SYNTRA, no self-service.
 *
 * Crea el usuario del dueño con una contraseña temporal y después el negocio.
 * Si el segundo paso falla, se BORRA el usuario recién creado: dejar un usuario
 * suelto sin negocio hace que el email quede tomado y el reintento falle.
 */
export async function crearNegocio(input: unknown): Promise<AltaResult> {
  await requireSuperadmin();

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisá los datos." };
  }

  const admin = createAdminClient();
  const password = passwordTemporal();

  const { data: creado, error: errUser } = await admin.auth.admin.createUser({
    email: parsed.data.ownerEmail,
    password,
    email_confirm: true, // no hay SMTP todavía: se confirma en el alta
    user_metadata: { full_name: parsed.data.ownerName ?? parsed.data.name },
  });

  if (errUser || !creado.user) {
    const msg = errUser?.message ?? "";
    if (msg.toLowerCase().includes("already")) {
      return { ok: false, error: "Ese email ya tiene una cuenta en StockFlow." };
    }
    return { ok: false, error: "No pudimos crear el usuario del dueño." };
  }

  const { error: errStore } = await admin.rpc("create_store", {
    p_name: parsed.data.name,
    p_slug: parsed.data.slug,
    p_owner_profile: creado.user.id,
    p_owner_name: parsed.data.ownerName,
    p_accent: parsed.data.accent,
  });

  if (errStore) {
    // Rollback manual: el usuario ya existe pero el negocio no.
    await admin.auth.admin.deleteUser(creado.user.id);

    const m = errStore.message;
    if (m.includes("slug_taken")) {
      return { ok: false, error: "Esa dirección ya está usada por otro negocio." };
    }
    if (m.includes("invalid_slug")) {
      return { ok: false, error: "La dirección va en minúsculas, sin espacios ni acentos." };
    }
    if (m.includes("already_owner")) {
      return { ok: false, error: "Esa persona ya es dueña de otro negocio." };
    }
    return { ok: false, error: "No pudimos crear el negocio." };
  }

  revalidatePath("/super");
  return {
    ok: true,
    store: parsed.data.name,
    email: parsed.data.ownerEmail,
    password,
  };
}

/** Suspender o reactivar un negocio (falta de pago, baja temporal). */
export async function cambiarEstado(
  storeId: string,
  status: "active" | "suspended",
): Promise<{ ok: boolean }> {
  await requireSuperadmin();
  const admin = createAdminClient();
  await admin.from("stores").update({ status }).eq("id", storeId);
  revalidatePath("/super");
  return { ok: true };
}
