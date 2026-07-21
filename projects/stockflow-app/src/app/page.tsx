import { redirect } from "next/navigation";

/**
 * Raíz: el ruteo real por rol (owner → /admin, staff → /pos) se resuelve en el
 * login cuando exista auth (tanda 1B). Por ahora entra al panel del dueño.
 */
export default function Home() {
  redirect("/admin");
}
