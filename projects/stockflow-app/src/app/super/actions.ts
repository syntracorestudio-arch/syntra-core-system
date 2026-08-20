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
  /* 069 · cuándo entró la plata de verdad. Vacío = hoy, que es el caso normal.
     Sin este dato la conciliación no cierra: un pago transferido el viernes y
     cargado el lunes figuraba como del lunes y no matcheaba el extracto. */
  pagadoEl?: string,
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
    p_pagado_el: pagadoEl && /^\d{4}-\d{2}-\d{2}$/.test(pagadoEl) ? pagadoEl : null,
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
      : m.includes("pagado_el_futuro") ? "La fecha de pago no puede ser futura."
      : m.includes("sin_suscripcion") ? "Ese negocio no tiene un plan asignado."
      : m.includes("monto_invalido") ? "El monto tiene que ser mayor a cero."
      : "No pudimos registrar el pago.";
    return { ok: false, error: detalle };
  }

  revalidatePath("/super");
  return { ok: true };
}

/**
 * Alta de la suscripción de un negocio.
 *
 * NO recibe fechas, y eso es el arreglo. Antes las suscripciones se cargaban a
 * mano en la base, y la verificación adversarial midió dos tipeos plausibles
 * que terminaban en cortes indebidos: `cobra_desde` con la fecha del alta
 * (corte a los 5 días, con 15 de "atraso") y `prueba_hasta` solapado con
 * `cobra_desde` (deber el mes que era gratis). Un campo que no existe no se
 * puede tipear mal: acá se elige precio y si lleva mes de prueba, y la base
 * calcula el resto.
 */
export async function crearSuscripcion(
  storeId: string,
  precio: number,
  conPrueba: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const { userId } = await requireSuperadmin();
  if (!(await limitarSuper(userId))) {
    return { ok: false, error: "Demasiadas acciones seguidas. Esperá un minuto." };
  }
  if (!z.guid().safeParse(storeId).success) {
    return { ok: false, error: "Negocio inválido." };
  }
  if (!Number.isFinite(precio) || precio <= 0) {
    return { ok: false, error: "El precio tiene que ser mayor a cero." };
  }

  const admin = createAdminClient();
  const { error } = await admin.rpc("crear_suscripcion", {
    p_store_id: storeId,
    p_precio: precio,
    p_actor: userId,
    p_con_prueba: conPrueba,
  });

  if (error) {
    const m = error.message;
    return {
      ok: false,
      error: m.includes("ya_tiene_suscripcion")
        ? "Ese negocio ya tiene un plan."
        : m.includes("precio_invalido")
          ? "El precio tiene que ser mayor a cero."
          : "No pudimos crear el plan.",
    };
  }

  revalidatePath("/super");
  return { ok: true };
}

/**
 * Cambiar el precio mensual.
 *
 * Rige desde el mes SIGUIENTE y no toca lo adeudado: decisión del owner —
 * "si un cliente está moroso, el valor de los meses que deba queda congelado".
 * Antes, subir la cuota le subía retroactivamente la deuda a quien ya debía,
 * sin que nadie pagara ni dejara de pagar.
 */
export async function cambiarPrecioSuscripcion(
  storeId: string,
  precio: number,
  motivo: string,
): Promise<{ ok: boolean; error?: string; desde?: string }> {
  const { userId } = await requireSuperadmin();
  if (!(await limitarSuper(userId))) {
    return { ok: false, error: "Demasiadas acciones seguidas. Esperá un minuto." };
  }
  if (!z.guid().safeParse(storeId).success) {
    return { ok: false, error: "Negocio inválido." };
  }
  if (!Number.isFinite(precio) || precio <= 0) {
    return { ok: false, error: "El precio tiene que ser mayor a cero." };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("cambiar_precio_suscripcion", {
    p_store_id: storeId,
    p_precio: precio,
    p_motivo: motivo,
    p_actor: userId,
  });

  if (error) {
    const m = error.message;
    return {
      ok: false,
      error: m.includes("motivo_requerido")
        ? "Poné el motivo del cambio (mínimo 10 caracteres)."
        : m.includes("sin_suscripcion")
          ? "Ese negocio no tiene un plan asignado."
          : "No pudimos cambiar el precio.",
    };
  }

  revalidatePath("/super");
  return { ok: true, desde: (data as { desde?: string } | null)?.desde };
}

/** Dar de baja (o reactivar) la suscripción. No borra el historial de pagos. */
export async function cancelarSuscripcion(
  storeId: string,
  motivo: string,
  reactivar = false,
): Promise<{ ok: boolean; error?: string }> {
  const { userId } = await requireSuperadmin();
  if (!(await limitarSuper(userId))) {
    return { ok: false, error: "Demasiadas acciones seguidas. Esperá un minuto." };
  }
  if (!z.guid().safeParse(storeId).success) {
    return { ok: false, error: "Negocio inválido." };
  }

  const admin = createAdminClient();
  const { error } = await admin.rpc("cancelar_suscripcion", {
    p_store_id: storeId,
    p_motivo: motivo,
    p_actor: userId,
    p_reactivar: reactivar,
  });

  if (error) {
    return {
      ok: false,
      error: error.message.includes("motivo_requerido")
        ? "Poné el motivo (mínimo 10 caracteres)."
        : "No pudimos actualizar el plan.",
    };
  }

  revalidatePath("/super");
  return { ok: true };
}

/**
 * Reemitir la contraseña del DUEÑO de un negocio.
 *
 * POR QUÉ EXISTE. Las credenciales se muestran una sola vez, en el alta
 * ("no la vas a poder ver de nuevo"), y no había ninguna forma de volver a
 * emitirlas. "Me olvidé la contraseña" manda un email que HOY NO SALE: el SMTP
 * está gateado por la compra del dominio (despliegue-plan.md §5.1b). O sea que
 * un cliente que perdía la clave se quedaba afuera de su propio negocio y el
 * único camino era abrir Supabase a mano.
 *
 * Es la contracara de `resetearClaveEmpleado` (equipo/actions.ts): aquel lo usa
 * el dueño con su equipo; éste lo usa SYNTRA con el dueño, que es el único que
 * no tiene a nadie arriba para rescatarlo.
 *
 * CIERRA LAS SESIONES ABIERTAS, igual que el reset de empleados. Es deliberado
 * y tiene un costo real: si el negocio está vendiendo con esa cuenta, la caja
 * se cae y hay que volver a entrar. Se acepta porque la alternativa es peor —
 * una clave reemitida que no expulsa a quien tenía la vieja no es un reset, es
 * una segunda llave. Como esto se dispara cuando el dueño LLAMA porque no puede
 * entrar, en la práctica casi nunca hay sesión que cortar.
 */
export async function reemitirCredenciales(
  storeId: string,
  motivo: string,
): Promise<AltaResult> {
  const { userId, email } = await requireSuperadmin();
  if (!(await limitarSuper(userId))) {
    return { ok: false, error: "Demasiadas acciones seguidas. Esperá un minuto." };
  }
  if (motivo.trim().length < 10) {
    return { ok: false, error: "Contá en una línea por qué se reemite." };
  }

  const admin = createAdminClient();

  /* El dueño del negocio. Se resuelve por `members` y no por un campo en
     `stores` porque la titularidad vive ahí (001:39) y puede haber cambiado. */
  const { data: duenio } = await admin
    .from("members")
    .select("profile_id, store:stores!inner ( name ), profile:profiles!members_profile_id_fkey!inner ( email )")
    .eq("store_id", storeId)
    .eq("role", "owner")
    .eq("status", "active")
    .maybeSingle();

  if (!duenio) {
    return { ok: false, error: "Ese negocio no tiene un dueño activo." };
  }

  const objetivo = duenio as unknown as {
    profile_id: string;
    store: { name: string } | null;
    profile: { email: string | null } | null;
  };
  const nombreNegocio = objetivo.store?.name ?? "el negocio";
  const emailDuenio = objetivo.profile?.email ?? null;

  if (!emailDuenio) {
    return { ok: false, error: "El dueño no tiene email cargado." };
  }

  /* La bitácora va PRIMERO, mismo criterio que suspender. Si fallara DESPUÉS,
     el dueño se encontraría con que su contraseña dejó de andar y sin ninguna
     fila que se lo explique — que es exactamente la sensación de haber sido
     hackeado. Al revés, el peor caso es una fila de más. */
  try {
    await registrarOFallar({
      actorId: userId,
      actorEmail: email,
      accion: "credenciales_reemitidas",
      motivo,
      storeId,
      profileId: objetivo.profile_id,
      etiqueta: nombreNegocio,
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo registrar." };
  }

  const password = credencialTemporal();
  const { error: errPass } = await admin.auth.admin.updateUserById(objetivo.profile_id, {
    password,
  });
  if (errPass) {
    return { ok: false, error: "No pudimos cambiar la contraseña." };
  }

  /* Provisoria por definición: esta clave la dictamos nosotros por teléfono.
     A diferencia del superadmin, acá el flag SÍ se hace cumplir — el dueño
     entra por `getSession`, que lo manda a /clave (session.ts:174). */
  await admin
    .from("profiles")
    .update({ must_change_password: true })
    .eq("id", objetivo.profile_id);

  await admin.auth.admin.signOut(objetivo.profile_id, "global");

  revalidatePath("/super");
  return { ok: true, store: nombreNegocio, email: emailDuenio, password };
}

/* ═══════════════════════════════════════════════════════════════════════════
   066 · EL CONTACTO HUMANO Y LAS NOTAS

   "71 días de atraso" se lee igual hayas reclamado tres veces o ninguna, y son
   dos conversaciones opuestas. La escalera automática registra lo que manda el
   sistema; esto registra lo que hizo la persona.

   Las tres revalidan la ficha Y la cartera: el "último contacto" se muestra en
   las dos, y que una quede vieja hace dudar de las dos.
   ═════════════════════════════════════════════════════════════════════════ */

const CANALES = ["whatsapp", "llamada", "email", "presencial", "otro"] as const;
export type Canal = (typeof CANALES)[number];

export async function registrarContacto(
  storeId: string,
  canal: string,
  resumen: string,
  seguimiento: string | null,
  tocarSeguimiento: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const { userId, email } = await requireSuperadmin();
  if (!(await limitarSuper(userId))) {
    return { ok: false, error: "Demasiadas acciones seguidas. Esperá un minuto." };
  }
  if (!CANALES.includes(canal as Canal)) {
    return { ok: false, error: "Elegí por dónde lo contactaste." };
  }
  if (resumen.trim().length < 3) {
    return { ok: false, error: "Escribí aunque sea dos palabras de qué pasó." };
  }

  const admin = createAdminClient();
  const { error } = await admin.rpc("registrar_contacto", {
    p_store_id: storeId,
    p_canal: canal,
    p_resumen: resumen.trim(),
    p_actor_id: userId,
    p_actor_email: email,
    p_seguimiento: seguimiento,
    p_tocar_seguimiento: tocarSeguimiento,
  });

  if (error) {
    if (error.message.includes("seguimiento_en_el_pasado")) {
      return { ok: false, error: "Esa fecha ya pasó." };
    }
    return { ok: false, error: "No pudimos registrar el contacto." };
  }

  /* "layout" y no la ruta a secas: la ficha vive en /super/<slug> y acá sólo
     tenemos el id. Revalidar el layout alcanza a /super y a todas sus hijas de
     una, sin tener que salir a buscar el slug para invalidar una sola. */
  revalidatePath("/super", "layout");
  return { ok: true };
}

/**
 * Borrar un contacto cargado por error.
 *
 * Existe DELETE pero no UPDATE (066): son notas internas del operador sobre sí
 * mismo, así que cargar una en el negocio equivocado tiene que poder deshacerse
 * —si no, la lista se llena de basura y se deja de mirar—, pero reescribir "ya
 * le reclamé" en silencio, no. Se borra y se carga de nuevo, y la fecha nueva
 * queda a la vista.
 */
export async function borrarContacto(id: string): Promise<{ ok: boolean; error?: string }> {
  const { userId } = await requireSuperadmin();
  if (!(await limitarSuper(userId))) {
    return { ok: false, error: "Demasiadas acciones seguidas. Esperá un minuto." };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("client_contacts").delete().eq("id", id);
  if (error) return { ok: false, error: "No pudimos borrarlo." };

  revalidatePath("/super", "layout");
  return { ok: true };
}

export async function guardarNotas(
  storeId: string,
  notas: string,
): Promise<{ ok: boolean; error?: string }> {
  const { userId } = await requireSuperadmin();
  if (!(await limitarSuper(userId))) {
    return { ok: false, error: "Demasiadas acciones seguidas. Esperá un minuto." };
  }
  if (notas.length > 2000) {
    return { ok: false, error: "La nota es muy larga (máximo 2000 caracteres)." };
  }

  const admin = createAdminClient();
  const { error } = await admin.rpc("guardar_notas", {
    p_store_id: storeId,
    p_notas: notas,
  });

  if (error) {
    /* Sin plan no hay dónde guardar la nota: `notas` vive en `subscriptions`.
       Se dice con todas las letras en vez de fallar genérico, porque la
       solución es concreta y está a un click. */
    if (error.message.includes("sin_suscripcion")) {
      return { ok: false, error: "Asignale un plan al negocio antes de dejarle notas." };
    }
    return { ok: false, error: "No pudimos guardar la nota." };
  }

  revalidatePath("/super", "layout");
  return { ok: true };
}
