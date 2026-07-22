"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOwner } from "@/lib/session";

export type Result = { ok: true } | { ok: false; error: string };
export type AltaEmpleado =
  | { ok: true; nombre: string; email: string; password: string }
  | { ok: false; error: string };

const empleadoSchema = z.object({
  nombre: z.string().trim().min(2, "Poné el nombre.").max(80),
  email: z.string().email("Revisá el email."),
  puedeFiar: z.boolean(),
  puedeDescuento: z.boolean(),
  puedeAnular: z.boolean(),
  puedeRecibir: z.boolean(),
  veCostos: z.boolean(),
});

/** Contraseña temporal legible: el dueño se la dicta a su empleado. */
function passwordTemporal(): string {
  const palabras = ["caja", "gondola", "vuelto", "mostrador", "changuito"];
  const palabra = palabras[Math.floor(Math.random() * palabras.length)];
  return `${palabra}-${Math.floor(1000 + Math.random() * 9000)}`;
}

/**
 * Alta de un empleado.
 *
 * Sin esto, todo el sistema de permisos que existe en el modelo —quién puede
 * fiar, quién ve los costos, quién anula— era inalcanzable: el dueño no tenía
 * forma de crearle la cuenta a su cajera.
 */
export async function crearEmpleado(input: unknown): Promise<AltaEmpleado> {
  const session = await requireOwner();

  const parsed = empleadoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisá los datos." };
  }

  const admin = createAdminClient();
  const password = passwordTemporal();

  const { data: creado, error: errUser } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password,
    email_confirm: true,
    user_metadata: { full_name: parsed.data.nombre },
  });

  if (errUser || !creado.user) {
    if ((errUser?.message ?? "").toLowerCase().includes("already")) {
      return { ok: false, error: "Ese email ya tiene una cuenta en StockFlow." };
    }
    return { ok: false, error: "No pudimos crear la cuenta." };
  }

  const supabase = await createSupabaseServer();
  const { error: errMember } = await supabase.rpc("add_member", {
    p_store_id: session.store.id,
    p_profile_id: creado.user.id,
    p_name: parsed.data.nombre,
    p_can_sell_on_credit: parsed.data.puedeFiar,
    p_can_apply_discount: parsed.data.puedeDescuento,
    p_can_void_sale: parsed.data.puedeAnular,
    p_can_receive_stock: parsed.data.puedeRecibir,
    p_can_see_costs: parsed.data.veCostos,
  });

  if (errMember) {
    // Rollback: un usuario sin negocio deja el email tomado y el reintento falla.
    await admin.auth.admin.deleteUser(creado.user.id);
    if (errMember.message.includes("already_member")) {
      return { ok: false, error: "Esa persona ya trabaja en este negocio." };
    }
    return { ok: false, error: "No pudimos sumar a la persona al equipo." };
  }

  revalidatePath("/admin/equipo");
  return { ok: true, nombre: parsed.data.nombre, email: parsed.data.email, password };
}

export async function actualizarPermisos(
  memberId: string,
  permisos: {
    puedeFiar: boolean;
    puedeDescuento: boolean;
    puedeAnular: boolean;
    puedeRecibir: boolean;
    veCostos: boolean;
  },
): Promise<Result> {
  const session = await requireOwner();
  const supabase = await createSupabaseServer();

  const { error } = await supabase.rpc("actualizar_permisos", {
    p_store_id: session.store.id,
    p_member_id: memberId,
    p_fiar: permisos.puedeFiar,
    p_descuento: permisos.puedeDescuento,
    p_anular: permisos.puedeAnular,
    p_recibir: permisos.puedeRecibir,
    p_costos: permisos.veCostos,
  });

  if (error) return { ok: false, error: "No pudimos guardar los permisos." };
  revalidatePath("/admin/equipo");
  return { ok: true };
}

/** Dar de baja a alguien que se fue. No se borra: sus ventas siguen contando. */
export async function cambiarEstado(memberId: string, activo: boolean): Promise<Result> {
  const session = await requireOwner();
  const supabase = await createSupabaseServer();

  const { error } = await supabase.rpc("cambiar_estado_miembro", {
    p_store_id: session.store.id,
    p_member_id: memberId,
    p_estado: activo ? "active" : "inactive",
  });

  if (error) return { ok: false, error: "No pudimos cambiar el estado." };
  revalidatePath("/admin/equipo");
  return { ok: true };
}
