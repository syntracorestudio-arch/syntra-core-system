import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Deja constancia de una acción de SYNTRA sobre el negocio de un cliente.
 *
 * `/super` corre con `service_role` (saltea RLS): desde ahí se puede suspender
 * un negocio, crearlo o prenderle el asistente. Sin esto, la única prueba de
 * que algo pasó es la memoria del que lo hizo.
 *
 * Lo que lo vuelve soporte y no puerta trasera es que **el dueño lee estas
 * filas** en su propia pantalla (`/cuenta`, "Actividad de SYNTRA"). Por eso el
 * texto de `accion` y `motivo` se escribe PARA ÉL, no para nosotros: "Kiosco
 * suspendido" y no "UPDATE stores SET status".
 *
 * Falla RUIDOSAMENTE a propósito: si no se puede registrar, la acción no se
 * hace (ver `registrarOFallar`). Una bitácora con agujeros silenciosos es peor
 * que no tenerla, porque genera confianza que no está respaldada.
 */
export type AccionPlataforma =
  | "negocio_creado"
  | "negocio_suspendido"
  | "negocio_reactivado"
  | "asistente_activado"
  | "asistente_desactivado"
  | "credenciales_reemitidas";

/** Etiqueta que ve el DUEÑO. En su idioma, no en el nuestro. */
export const ETIQUETA_ACCION: Record<AccionPlataforma, string> = {
  negocio_creado: "Creamos tu negocio en StockFlow",
  negocio_suspendido: "Suspendimos el acceso a tu negocio",
  negocio_reactivado: "Reactivamos el acceso a tu negocio",
  asistente_activado: "Activamos el Asistente IA",
  asistente_desactivado: "Desactivamos el Asistente IA",
  /* La lee el DUEÑO en su propia pantalla, y es la fila más importante de
     todas para él: si ve esto y no lo pidió, alguien le cambió la clave. Por
     eso dice "a pedido tuyo" — vuelve verificable el motivo desde su lado. */
  credenciales_reemitidas: "Te reemitimos la contraseña a pedido tuyo",
};

export async function registrarOFallar(args: {
  /* 060 · nullable: una acción AUTOMÁTICA no tiene actor humano. El cron de
     cobranza suspende por falta de pago y no hay nadie a quien atribuirlo —
     inventar un uuid para llenar el campo sería peor que dejarlo vacío. El
     `actor_email` lo distingue igual ("cron@stockflow"). */
  actorId: string | null;
  actorEmail: string | null;
  accion: AccionPlataforma;
  motivo: string;
  storeId?: string | null;
  profileId?: string | null;
  etiqueta?: string | null;
}): Promise<void> {
  /* La IP se toma acá y no en la RPC: adentro de Postgres no existe. Sirve para
     distinguir "lo hizo Matías desde la oficina" de un acceso raro. */
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  const admin = createAdminClient();
  const { error } = await admin.rpc("registrar_accion_plataforma", {
    p_actor_id: args.actorId,
    p_actor_email: args.actorEmail ?? "desconocido",
    p_action: args.accion,
    p_reason: args.motivo,
    p_target_store: args.storeId ?? null,
    p_target_profile: args.profileId ?? null,
    p_target_label: args.etiqueta ?? null,
    p_ip: ip,
  });

  /* Se propaga en vez de tragarse: quien llama tiene que ABORTAR la mutación.
     Si el registro falla y la acción se hace igual, el cliente ve un negocio
     suspendido sin ninguna fila que lo explique — exactamente el estado que
     esta tabla existe para impedir. */
  if (error) {
    throw new Error(
      error.message.includes("reason_requerido")
        ? "Falta el motivo (mínimo 10 caracteres)."
        : "No pudimos registrar la acción. No se hizo ningún cambio.",
    );
  }
}
