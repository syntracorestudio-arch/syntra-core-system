import { redirect } from "next/navigation";
import { getSession, motivoSinAcceso } from "@/lib/session";
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

  /* 052 · POR QUÉ ACÁ TAMBIÉN, y no sólo en `requireSession`.
   *
   * Un empleado dado de baja SIGUE teniendo su usuario de auth vivo, así que
   * `signInWithPassword` le funciona: entra, cae en esta raíz, `getSession`
   * devuelve null porque su membresía está inactiva… y hasta ahora salía por un
   * `redirect("/login")` pelado, sin una palabra. El motivo estaba construido
   * (049) pero lo consumía sólo `requireSession`, y por este camino nunca se
   * pasa por ahí.
   *
   * Sin el aviso el resultado no es sólo confuso, es CARO: la persona concluye
   * que erró la clave, la reintenta, y a los 5 intentos el rate limit por
   * cuenta (login/actions.ts) la bloquea 15 minutos. Termina llamando al dueño
   * igual, pero enojada y sin saber por qué.
   *
   * La consulta extra sólo corre en el camino de fallo: el que entra bien ya
   * salió por el `redirect` de arriba. */
  if (auth.user) {
    const motivo = await motivoSinAcceso();
    if (motivo !== "sin_sesion") redirect(`/login?motivo=${motivo}`);
  }

  redirect("/login");
}
