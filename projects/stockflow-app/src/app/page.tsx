import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

/**
 * Raíz: rutea por rol. El dueño entra a su panel; el empleado, directo a la caja
 * (para él el POS ES la app). Se resuelve server-side para que nadie elija.
 */
export default async function Home() {
  const session = await getSession();
  if (!session) redirect("/login");
  redirect(session.member.role === "owner" ? "/admin" : "/pos");
}
