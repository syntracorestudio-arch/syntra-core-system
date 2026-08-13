"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSuperadmin } from "@/lib/superadmin";
import { credencialTemporal } from "@/lib/credenciales";

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
  // Rubro + add-on del asistente (019). Van con default seguro: si el alta no los
  // manda, el negocio queda kiosco y sin asistente.
  vertical: z.enum(["kiosco", "dietetica", "petshop", "otro"]).default("kiosco"),
  aiAssistant: z.boolean().default(false),
});

/* 049 · el generador se mudó a `@/lib/credenciales`: usaba `Math.random()`
   (no criptográfico) sobre 6 palabras — ~54.000 combinaciones — y como no
   había forma de cambiar la clave dentro del producto, esa era la contraseña
   definitiva del negocio para siempre. Ahora es CSPRNG sobre 64 palabras y
   nace con `must_change_password`. */

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
  const password = credencialTemporal();

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

  /* 049 · el RPC va dentro de try/catch y el rollback se VERIFICA. Antes, si
     la llamada *lanzaba* (red caída, timeout) en vez de devolver `{ error }`,
     la acción explotaba y el usuario de auth quedaba huérfano sin que se
     enterara nadie: el email quedaba tomado y el reintento fallaba con
     "ese email ya tiene una cuenta". */
  let errStore: { message: string } | null = null;
  let nuevoStore: unknown = null;
  try {
    const r = await admin.rpc("create_store", {
      p_name: parsed.data.name,
      p_slug: parsed.data.slug,
      p_owner_profile: creado.user.id,
      p_owner_name: parsed.data.ownerName,
      p_accent: parsed.data.accent,
    });
    errStore = r.error;
    nuevoStore = r.data;
  } catch (e) {
    errStore = { message: e instanceof Error ? e.message : "network" };
  }

  if (errStore) {
    /* Rollback: el usuario ya existe pero el negocio no. Se chequea el
       resultado — si el borrado TAMBIÉN falla, el error lo NOMBRA para que
       quede registro operativo de qué usuario hay que limpiar a mano. */
    const { error: errBorrado } = await admin.auth.admin.deleteUser(creado.user.id);
    if (errBorrado) {
      return {
        ok: false,
        error: `No pudimos crear el negocio y quedó un usuario suelto (${parsed.data.ownerEmail}). Borralo antes de reintentar.`,
      };
    }

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

  // Rubro + asistente se setean POST-alta, no dentro de `create_store`: esa RPC es
  // un contrato de 010 ya aplicado y no se re-corre. Un update aparte los aplica sin
  // tocar el onboarding. Si falla, el negocio queda con los defaults (kiosco / sin
  // asistente) y superadmin lo ajusta desde la fila — no es motivo de rollback.
  const storeId = (nuevoStore as { id?: string } | null)?.id;
  if (storeId && (parsed.data.vertical !== "kiosco" || parsed.data.aiAssistant)) {
    await admin
      .from("stores")
      .update({ vertical: parsed.data.vertical, ai_assistant_enabled: parsed.data.aiAssistant })
      .eq("id", storeId);
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

/**
 * Prender/apagar el add-on del Asistente IA para un negocio (019). Es el flag que
 * gatea el reporte mensual: solo los negocios con esto en true entran al cron.
 * Lo mueve SOLO superadmin por service_role, igual que `cambiarEstado`.
 */
export async function setAsistenteIA(
  storeId: string,
  enabled: boolean,
): Promise<{ ok: boolean }> {
  await requireSuperadmin();
  const admin = createAdminClient();
  await admin.from("stores").update({ ai_assistant_enabled: enabled }).eq("id", storeId);
  revalidatePath("/super");
  return { ok: true };
}
