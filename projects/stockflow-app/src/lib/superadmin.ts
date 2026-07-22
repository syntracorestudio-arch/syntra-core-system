import { redirect } from "next/navigation";
import { createSupabaseServer } from "./supabase/server";

/**
 * Guard del panel de SYNTRA.
 *
 * El superadmin no es un rol de negocio (esos viven en `members`): es un flag en
 * el perfil, porque es una facultad de la plataforma y no de un kiosco puntual.
 * Se marca a mano en la base después de aplicar las migraciones:
 *
 *   update public.profiles set is_superadmin = true where email = 'vos@...';
 *
 * Es deliberado que no haya UI para otorgarlo: si se pudiera dar desde la app,
 * cualquier owner comprometido escalaría a ver todos los negocios.
 */
export async function requireSuperadmin(): Promise<{ userId: string; email: string | null }> {
  const supabase = await createSupabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: perfil } = await supabase
    .from("profiles")
    .select("is_superadmin")
    .eq("id", auth.user.id)
    .maybeSingle();

  // Redirige a la raíz y no muestra un 403: quien no es superadmin no tiene por
  // qué enterarse de que este panel existe.
  if (!perfil?.is_superadmin) redirect("/");

  return { userId: auth.user.id, email: auth.user.email ?? null };
}
