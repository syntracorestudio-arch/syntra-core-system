"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOwner } from "@/lib/session";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  credencialTemporal,
  emailSintetico,
  normalizarUsuario,
  usuarioValido,
} from "@/lib/credenciales";

export type Result = { ok: true } | { ok: false; error: string };
export type AltaEmpleado =
  | { ok: true; nombre: string; usuario: string; kiosco: string; password: string }
  | { ok: false; error: string };

const empleadoSchema = z.object({
  nombre: z.string().trim().min(2, "Poné el nombre.").max(80),
  /* 050 · el empleado ya NO necesita email: la cajera de un kiosco muchas
     veces no tiene, y exigirlo era el bloqueante real del onboarding. */
  usuario: z
    .string()
    .trim()
    .min(1, "Poné un usuario.")
    .refine(usuarioValido, "El usuario va de 3 a 20 letras o números, sin espacios."),
  puedeFiar: z.boolean(),
  puedeAnular: z.boolean(),
  puedeRecibir: z.boolean(),
  /* 052 · el alta los ACEPTA pero no los usa: `add_member` no los toma y las
     columnas nacen en false. Están acá sólo para que el cliente pueda mandar
     su objeto de permisos entero sin recortarlo. Se otorgan desde Permisos,
     que es donde el dueño ya decidió que confía. */
  puedeCerrar: z.boolean().optional(),
  veReportes: z.boolean().optional(),
});

/* 049 · el generador se mudó a `@/lib/credenciales` (CSPRNG, 64 palabras).
   Ver la nota en `super/actions.ts`: el anterior era `Math.random()` sobre 5
   palabras y la credencial no se podía cambiar nunca. */

/**
 * Alta de un empleado.
 *
 * Sin esto, todo el sistema de permisos que existe en el modelo —quién puede
 * fiar, quién ve los costos, quién anula— era inalcanzable: el dueño no tenía
 * forma de crearle la cuenta a su cajera.
 */
/**
 * Freno del alta y del reseteo de credenciales (ítem 12 del plan de identidad).
 *
 * No es anti fuerza-bruta: acá ya hay que ser dueño del negocio. Es un techo
 * por si la sesión del dueño queda abierta en el mostrador — sin esto, quien
 * la agarre genera cuentas de empleado en serie, cada una con su credencial
 * válida, y ninguna llama la atención. 10 por minuto no molesta a nadie dando
 * de alta a su gente. Fail-open, como el resto del baseline.
 */
async function limitarEquipo(storeId: string): Promise<boolean> {
  return checkRateLimit(`equipo:${storeId}`, 10, 60);
}

export async function crearEmpleado(input: unknown): Promise<AltaEmpleado> {
  const session = await requireOwner();
  if (!(await limitarEquipo(session.store.id))) {
    return { ok: false, error: "Diste de alta a varias personas seguidas. Esperá un minuto." };
  }

  const parsed = empleadoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisá los datos." };
  }

  const admin = createAdminClient();
  const password = credencialTemporal();
  const usuario = normalizarUsuario(parsed.data.usuario);
  /* El email lo fabrica el sistema: `<usuario>.<slug>@staff.stockflow.invalid`.
     Nunca recibe correo, nunca se verifica, nunca se le muestra a nadie. Lo
     único que hace es darle a GoTrue el identificador con forma de email que
     necesita — porque `members.profile_id` es NOT NULL y todo el aislamiento
     cuelga de `auth.uid()`. */
  const email = emailSintetico(session.store.slug, usuario);

  const { data: creado, error: errUser } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: parsed.data.nombre },
  });

  if (errUser || !creado.user) {
    if ((errUser?.message ?? "").toLowerCase().includes("already")) {
      /* Nunca decir "ese email ya tiene cuenta": el dueño no tipeó ningún
         email y el mensaje sería desconcertante. */
      return { ok: false, error: `Ya hay alguien con el usuario "${usuario}" en tu negocio.` };
    }
    return { ok: false, error: "No pudimos crear la cuenta." };
  }

  const supabase = await createSupabaseServer();
  const { error: errMember } = await supabase.rpc("add_member", {
    p_store_id: session.store.id,
    p_profile_id: creado.user.id,
    p_name: parsed.data.nombre,
    p_can_sell_on_credit: parsed.data.puedeFiar,
    /* `can_apply_discount` nace y queda en false: la app no tiene ninguna
       pantalla que cambie el precio de una venta, así que el toggle se sacó
       (docs/permisos-audit.md §A.3). La columna y las 8 validaciones en SQL se
       dejan intactas para cuando la función exista. */
    p_can_apply_discount: false,
    p_can_void_sale: parsed.data.puedeAnular,
    p_can_receive_stock: parsed.data.puedeRecibir,
    /* `can_see_costs` ACOMPAÑA a `can_receive_stock` y ya no es un toggle
       propio: recibir mercadería obliga a anotar el costo, así que separarlos
       era una contradicción — la pantalla mostraba costos con el flag apagado.
       Derivarlo mantiene la columna verdadera. */
    p_can_see_costs: parsed.data.puedeRecibir,
    p_usuario: usuario,
  });

  if (errMember) {
    // Rollback: un usuario sin negocio deja el email tomado y el reintento falla.
    await admin.auth.admin.deleteUser(creado.user.id);
    if (errMember.message.includes("already_member")) {
      return { ok: false, error: "Esa persona ya trabaja en este negocio." };
    }
    if (errMember.message.includes("usuario_ocupado")) {
      return { ok: false, error: `Ya hay alguien con el usuario "${usuario}" en tu negocio.` };
    }
    if (errMember.message.includes("usuario_invalido")) {
      return { ok: false, error: "El usuario va de 3 a 20 letras o números." };
    }
    return { ok: false, error: "No pudimos sumar a la persona al equipo." };
  }

  revalidatePath("/admin/equipo");
  return {
    ok: true,
    nombre: parsed.data.nombre,
    usuario,
    kiosco: session.store.slug,
    password,
  };
}

export async function actualizarPermisos(
  memberId: string,
  permisos: {
    puedeFiar: boolean;
    puedeAnular: boolean;
    puedeRecibir: boolean;
    puedeCerrar: boolean;
    veReportes: boolean;
  },
): Promise<Result> {
  const session = await requireOwner();
  const supabase = await createSupabaseServer();

  const { error } = await supabase.rpc("actualizar_permisos", {
    p_store_id: session.store.id,
    p_member_id: memberId,
    p_fiar: permisos.puedeFiar,
    p_descuento: false, // ver el comentario de `p_can_apply_discount`
    p_anular: permisos.puedeAnular,
    p_recibir: permisos.puedeRecibir,
    p_costos: permisos.puedeRecibir,
    p_cerrar: permisos.puedeCerrar,
    p_reportes: permisos.veReportes,
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

/**
 * El dueño le resetea la clave a un empleado.
 *
 * Hasta la 050 esto no existía: si el empleado se olvidaba la clave, el dueño
 * no podía hacer NADA y el camino terminaba en SYNTRA abriendo Supabase a
 * mano. Es la mitad de la historia de recuperación que le toca al mostrador —
 * la otra (auto-servicio por email) es sólo del dueño, que sí tiene casilla.
 *
 * El `member_id` que llega del cliente NUNCA se usa contra el service_role sin
 * validar: `empleado_a_resetear` corre con la sesión del dueño y verifica que
 * ese member sea de SU negocio y no sea un owner. Recién con el `profile_id`
 * que devuelve se toca la API de admin.
 */
export type ResetClave =
  | { ok: true; nombre: string; usuario: string | null; password: string }
  | { ok: false; error: string };

export async function resetearClaveEmpleado(memberId: string): Promise<ResetClave> {
  const session = await requireOwner();
  if (!(await limitarEquipo(session.store.id))) {
    return { ok: false, error: "Reseteaste varias claves seguidas. Esperá un minuto." };
  }
  if (!z.guid().safeParse(memberId).success) {
    return { ok: false, error: "Esa persona ya no está en tu equipo." };
  }

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.rpc("empleado_a_resetear", {
    p_store_id: session.store.id,
    p_member_id: memberId,
  });

  if (error || !data) {
    if ((error?.message ?? "").includes("not_allowed")) {
      return { ok: false, error: "No tenés permiso para esto." };
    }
    return { ok: false, error: "Esa persona ya no está en tu equipo." };
  }

  const objetivo = data as { profile_id: string; display_name: string | null; usuario: string | null };
  const password = credencialTemporal();
  const admin = createAdminClient();

  const { error: errPass } = await admin.auth.admin.updateUserById(objetivo.profile_id, {
    password,
  });
  if (errPass) return { ok: false, error: "No pudimos cambiar la clave." };

  /* Que la vuelva a cambiar en el primer ingreso: esta clave la vio el dueño
     (se la dicta), así que es provisoria por definición — mismo criterio que
     el alta (049). */
  await admin
    .from("profiles")
    .update({ must_change_password: true })
    .eq("id", objetivo.profile_id);

  /* Y se cierran las sesiones abiertas de esa persona: sin esto, quien se
     llevó la clave vieja sigue adentro y el reset no sirve para nada. */
  await admin.auth.admin.signOut(objetivo.profile_id, "global");

  revalidatePath("/admin/equipo");
  return {
    ok: true,
    nombre: objetivo.display_name ?? "Empleado",
    usuario: objetivo.usuario,
    password,
  };
}
