"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSuperadmin } from "@/lib/superadmin";
import { credencialTemporal } from "@/lib/credenciales";
import { registrarOFallar } from "@/lib/auditoria";
import { checkRateLimit } from "@/lib/rate-limit";

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
  const { userId, email } = await requireSuperadmin();
  /* 056 · el alta también se limita. Era la ÚNICA de las tres acciones del
     panel sin freno, y es la más cara de repetir: cada intento crea un usuario
     de auth. */
  if (!(await limitarSuper(userId))) {
    return { ok: false, error: "Demasiadas acciones seguidas. Esperá un minuto." };
  }

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
      /* 056 · quién dio de alta este negocio. 055 creó la columna y nadie la
         llenaba: quedaba SIEMPRE en null en el camino real. */
      p_created_by: userId,
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

  /* 056 · el alta AUDITA, como las otras dos. La cabecera de 055 lo pedía
     explícitamente —"TODAS las mutaciones de /super, no sólo las de
     emergencia"— y ésta se había quedado afuera: `negocio_creado` estaba
     tipada y no la emitía nadie.
     Va DESPUÉS de crear y no antes, al revés que suspender: acá el negocio ya
     existe y no hay nada que abortar; fallar el registro no puede deshacer un
     usuario de auth ya creado. Si la bitácora falla, se avisa pero el alta se
     mantiene — perder el negocio recién creado sería peor que perder su fila
     de auditoría. */
  if (storeId) {
    try {
      await registrarOFallar({
        actorId: userId,
        actorEmail: email,
        accion: "negocio_creado",
        motivo: `Alta de ${parsed.data.name} (${parsed.data.slug}) para ${parsed.data.ownerEmail}.`,
        storeId,
        profileId: creado.user.id,
        etiqueta: parsed.data.name,
      });
    } catch {
      /* Se traga a propósito: el negocio YA está creado y funcionando. */
    }
  }

  revalidatePath("/super");
  return {
    ok: true,
    store: parsed.data.name,
    email: parsed.data.ownerEmail,
    password,
  };
}

/**
 * Suspender o reactivar un negocio (falta de pago, baja temporal).
 *
 * Es LA acción más grave del panel: suspender apaga la caja de un comercio que
 * está abierto. Por eso pide motivo y queda registrada ANTES de tocar nada —
 * si el registro falla, no se suspende (055).
 */
export async function cambiarEstado(
  storeId: string,
  status: "active" | "suspended",
  motivo: string,
): Promise<{ ok: boolean; error?: string }> {
  const { userId, email } = await requireSuperadmin();
  if (!(await limitarSuper(userId))) {
    return { ok: false, error: "Demasiadas acciones seguidas. Esperá un minuto." };
  }

  const admin = createAdminClient();
  const { data: negocio } = await admin
    .from("stores")
    .select("name")
    .eq("id", storeId)
    .maybeSingle();

  try {
    /* El registro va PRIMERO. Al revés, un fallo de la bitácora dejaría un
       negocio suspendido sin ninguna fila que se lo explique al dueño. */
    await registrarOFallar({
      actorId: userId,
      actorEmail: email,
      accion: status === "suspended" ? "negocio_suspendido" : "negocio_reactivado",
      motivo,
      storeId,
      etiqueta: negocio?.name ?? null,
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo registrar." };
  }

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
  motivo: string,
): Promise<{ ok: boolean; error?: string }> {
  const { userId, email } = await requireSuperadmin();
  if (!(await limitarSuper(userId))) {
    return { ok: false, error: "Demasiadas acciones seguidas. Esperá un minuto." };
  }

  const admin = createAdminClient();
  const { data: negocio } = await admin
    .from("stores")
    .select("name")
    .eq("id", storeId)
    .maybeSingle();

  try {
    await registrarOFallar({
      actorId: userId,
      actorEmail: email,
      accion: enabled ? "asistente_activado" : "asistente_desactivado",
      motivo,
      storeId,
      etiqueta: negocio?.name ?? null,
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo registrar." };
  }

  await admin.from("stores").update({ ai_assistant_enabled: enabled }).eq("id", storeId);
  revalidatePath("/super");
  return { ok: true };
}

/**
 * Freno del panel de plataforma (ítem 12).
 *
 * No es anti fuerza-bruta —acá ya hay que ser superadmin— sino un techo por si
 * una credencial nuestra se compromete: sin esto, quien la tenga suspende los
 * negocios de todos los clientes en un `for`. 20 por minuto no molesta a nadie
 * trabajando y corta un script. Fail-open, igual que el resto.
 */
async function limitarSuper(userId: string): Promise<boolean> {
  return checkRateLimit(`super:${userId}`, 20, 60);
}

/**
 * Marcar el pago de un mes.
 *
 * Es el acto que sostiene todo el modelo manual: no hay integración de pagos, el
 * cliente transfiere al alias y esto es lo que lo asienta. Por eso deja rastro
 * —quién lo marcó y cuándo— y por eso la base impide marcar el mismo mes dos
 * veces: un pago duplicado deja al cliente "al día" por partida doble y la suma
 * de ingresos miente hacia arriba.
 *
 * El período se manda como el primer día del mes; la base igual lo normaliza
 * (057), así que un 2026-08-23 y un 2026-08-01 son el mismo mes y el segundo
 * choca contra el UNIQUE.
 */
export async function marcarPagoSuscripcion(
  storeId: string,
  periodo: string,
  monto: number,
  nota?: string,
): Promise<{ ok: boolean; error?: string }> {
  const { userId } = await requireSuperadmin();
  if (!(await limitarSuper(userId))) {
    return { ok: false, error: "Demasiadas acciones seguidas. Esperá un minuto." };
  }

  if (!z.guid().safeParse(storeId).success) {
    return { ok: false, error: "Negocio inválido." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(periodo)) {
    return { ok: false, error: "Período inválido." };
  }
  /* El monto se valida acá y no sólo en la base: un `NaN` que llegue del input
     se guardaría como null y el ingreso del mes quedaría en cero sin aviso. */
  if (!Number.isFinite(monto) || monto < 0) {
    return { ok: false, error: "Monto inválido." };
  }

  const admin = createAdminClient();
  const { error } = await admin.rpc("marcar_pago_suscripcion", {
    p_store_id: storeId,
    p_periodo: periodo,
    p_monto: monto,
    p_actor: userId,
    p_medio: "transferencia",
    p_nota: nota ?? null,
  });

  if (error) {
    /* 058 · cada error dice QUÉ hacer. Antes todo caía en "no pudimos
       registrar el pago", que ante un período mal tipeado —un click de más en
       el año— dejaba al operador reintentando lo mismo. */
    const m = error.message;
    const detalle =
      m.includes("periodo_ya_pagado") ? "Ese mes ya está saldado."
      : m.includes("monto_excede_lo_adeudado") ? "El monto supera lo que falta de ese mes. Revisá el período."
      : m.includes("periodo_anterior_al_alta") ? "Ese mes es anterior al alta del negocio."
      : m.includes("periodo_futuro") ? "No se puede registrar un mes que todavía no empezó."
      : m.includes("sin_suscripcion") ? "Ese negocio no tiene un plan asignado."
      : m.includes("monto_invalido") ? "El monto tiene que ser mayor a cero."
      : "No pudimos registrar el pago.";
    return { ok: false, error: detalle };
  }

  revalidatePath("/super");
  return { ok: true };
}
