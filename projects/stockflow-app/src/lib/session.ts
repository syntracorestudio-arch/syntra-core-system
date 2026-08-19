import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "./supabase/server";
import { SELECT_SESION } from "./session-select";

/**
 * Contexto del usuario logueado: quién es, en qué negocio opera y qué puede hacer.
 *
 * Un profile puede ser miembro de varios negocios (el modelo es N:N), pero la UX
 * del MVP asume UNO principal — igual que StudioFlow con su "estudio principal".
 * Cuando aparezca el primer dueño con dos locales, acá va el selector.
 *
 * `cache()` lo memoiza por request: el layout y la página lo piden por separado
 * y no queremos dos viajes a la base por render.
 */

export type Member = {
  id: string;
  role: "owner" | "staff";
  display_name: string | null;
  can_sell_on_credit: boolean;
  can_apply_discount: boolean;
  can_void_sale: boolean;
  can_receive_stock: boolean;
  can_see_costs: boolean;
  /** 052 · cierra el turno; NO ve la recaudación. */
  can_close_register: boolean;
  /** 052 · ve qué se vende y qué falta, en unidades. Sin plata. */
  can_see_reports: boolean;
  /* 050 · el nombre con el que ENTRA el empleado; null para el dueño, que usa
     su email real. Lo necesita `/cuenta`: mostrarle a un empleado su email
     sintético no le dice nada — ese string lo fabricó el sistema, no él. */
  usuario: string | null;
};

export type Store = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  branding: { accent?: string; logo_url?: string } | null;
  status: string;
  /** Rubro del negocio (019). Decide qué series de INDEC mira el asistente. */
  vertical: string;
  /** Add-on del Asistente IA (019). Gatea la página del asistente y sus crons. */
  ai_assistant_enabled: boolean;
};

export type SessionContext = {
  userId: string;
  email: string | null;
  member: Member;
  store: Store;
  /** 049 · la credencial de alta todavía no se cambió: ninguna ruta responde. */
  mustChangePassword: boolean;
  /* 056 · viene en la MISMA consulta que ya lee `profiles`, así que saberlo
     cuesta cero. Sin esto, rutear la raíz por superadmin obligaba a una segunda
     query a `profiles` en CADA visita de CADA usuario, para un caso que aplica
     a una persona en toda la plataforma. */
  esSuperadmin: boolean;
};

/** Por qué alguien con usuario válido no tiene sesión. Alimenta el mensaje del login. */
export type MotivoSinAcceso =
  | "sin_sesion"
  | "sin_acceso"
  | "sin_membresia"
  | "negocio_suspendido";

export const getSession = cache(async (): Promise<SessionContext | null> => {
  const supabase = await createSupabaseServer();

  // getUser() revalida el token contra Supabase; getSession() confía en la cookie.
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data, error } = await supabase
    .from("members")
    /* La FK del embed va EXPLÍCITA (`!members_profile_id_fkey`), y no es
       cosmético: `members` tiene DOS caminos a `profiles` desde que la 055
       agregó `created_by`. Con `profiles!inner` a secas PostgREST no puede
       desambiguar, devuelve PGRST201, y esta consulta falla ENTERA ⇒
       `getSession` da null ⇒ TODO el mundo rebota al login.

       Pasó de verdad: la 055 dejó la app sin acceso y no lo vio NI UN test —
       tsc, lint, build y 25 suites SQL en verde, porque ninguna prueba tocaba
       un embed de PostgREST.

       Regla: todo embed nombra su FK. Así, el día que alguien agregue otra
       columna apuntando a la misma tabla, esta consulta ni se entera. */
    .select(
SELECT_SESION)
    .eq("profile_id", auth.user.id)
    .eq("status", "active")
    /* 049 · un negocio suspendido desde /super NO opera. Era el único
       apalancamiento de cobranza del producto y no tenía efecto: la sesión
       leía `stores.status` y no lo miraba nunca. */
    .eq("store.status", "active")
    /* 049 · determinismo. Antes era `.limit(1)` SIN `order by`: con dos
       membresías activas el negocio lo elegía el planner. `role` ascendente
       pone 'owner' antes que 'staff' (alfabético), y después gana el más
       viejo ⇒ "tu negocio principal es el más viejo donde sos dueño". */
    .order("role", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  const store = data.store as unknown as Store;
  const profile = data.profile as unknown as {
    must_change_password: boolean;
    is_superadmin: boolean;
  } | null;

  return {
    userId: auth.user.id,
    email: auth.user.email ?? null,
    member: {
      id: data.id,
      role: data.role,
      display_name: data.display_name,
      can_sell_on_credit: data.can_sell_on_credit,
      can_apply_discount: data.can_apply_discount,
      can_void_sale: data.can_void_sale,
      can_receive_stock: data.can_receive_stock,
      can_see_costs: data.can_see_costs,
      usuario: data.usuario ?? null,
      can_close_register: data.can_close_register,
      can_see_reports: data.can_see_reports,
    },
    store,
    mustChangePassword: profile?.must_change_password ?? false,
    esSuperadmin: profile?.is_superadmin ?? false,
  };
});

/**
 * POR QUÉ no hay sesión — sólo se llama cuando `getSession()` ya dio null.
 *
 * Es una segunda consulta a propósito: el camino feliz sigue costando una sola.
 * Existe porque el mensaje importa: hasta ahora el empleado dado de baja el
 * domingo a la noche veía el login genérico, creía haberse equivocado de clave
 * y terminaba llamando al dueño.
 */
export async function motivoSinAcceso(): Promise<MotivoSinAcceso> {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.rpc("mi_acceso");
  if (error || !data) return "sin_sesion";
  const estado = (data as { estado?: string }).estado;
  if (
    estado === "sin_acceso" ||
    estado === "sin_membresia" ||
    estado === "negocio_suspendido"
  ) {
    return estado;
  }
  return "sin_sesion";
}

/**
 * Guard de página. El proxy ya exige sesión; esto además exige que el usuario
 * SEA miembro activo de un negocio ACTIVO, y que ya haya cambiado la
 * credencial con la que lo dieron de alta.
 */
export async function requireSession(): Promise<SessionContext> {
  const session = await getSession();
  if (!session) {
    const motivo = await motivoSinAcceso();
    redirect(motivo === "sin_sesion" ? "/login" : `/login?motivo=${motivo}`);
  }
  /* 049 · la guarda del cambio obligatorio vive acá y no en el cliente: si
     estuviera en el cliente, entrar por URL a cualquier ruta la esquivaría. */
  if (session.mustChangePassword) redirect("/clave");
  return session;
}

/** Guard de las pantallas del dueño. */
export async function requireOwner(): Promise<SessionContext> {
  const session = await requireSession();
  if (session.member.role !== "owner") redirect("/pos");
  return session;
}
