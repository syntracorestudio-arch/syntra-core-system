import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { createSupabaseServer } from "@/lib/supabase/server";

/**
 * Raíz: rutea por rol. El dueño entra a su panel; el empleado, directo a la caja
 * (para él el POS ES la app). Se resuelve server-side para que nadie elija.
 */
export default async function Home() {
  const session = await getSession();
  if (session) redirect(session.member.role === "owner" ? "/admin" : "/pos");

  // Sin membresía: puede ser el superadmin de la plataforma (no es un rol de
  // negocio, es un flag del perfil) antes de mandarlo a /login. Sin esto caería
  // en un rebote /→/login que parece un login fallido.
  const supabase = await createSupabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (auth.user) {
    const { data: perfil } = await supabase
      .from("profiles")
      .select("is_superadmin")
      .eq("id", auth.user.id)
      .maybeSingle();
    if (perfil?.is_superadmin) redirect("/super");
  }

  redirect("/login");
}
