import { redirect } from "next/navigation";

/** El historial vive ahora dentro de "Mi actividad" (shell del alumno, T1). */
export default function HistorialRedirect() {
  redirect("/app/actividad");
}
