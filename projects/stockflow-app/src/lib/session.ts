import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "./supabase/server";

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
};

export type Store = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  branding: { accent?: string; logo_url?: string } | null;
  status: string;
};

export type SessionContext = {
  userId: string;
  email: string | null;
  member: Member;
  store: Store;
};

export const getSession = cache(async (): Promise<SessionContext | null> => {
  const supabase = await createSupabaseServer();

  // getUser() revalida el token contra Supabase; getSession() confía en la cookie.
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data, error } = await supabase
    .from("members")
    .select(
      `id, role, display_name, can_sell_on_credit, can_apply_discount,
       can_void_sale, can_receive_stock, can_see_costs,
       store:stores!inner ( id, name, slug, timezone, branding, status )`,
    )
    .eq("profile_id", auth.user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  const store = data.store as unknown as Store;

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
    },
    store,
  };
});

/**
 * Guard de página. El middleware ya exige sesión; esto además exige que el usuario
 * SEA miembro activo de un negocio (podría tener cuenta y ninguna pertenencia).
 */
export async function requireSession(): Promise<SessionContext> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/** Guard de las pantallas del dueño. */
export async function requireOwner(): Promise<SessionContext> {
  const session = await requireSession();
  if (session.member.role !== "owner") redirect("/pos");
  return session;
}
