import { PauseCircle, LogOut } from "lucide-react";

/**
 * Pantalla de estudio suspendido (Fase 5). Bloquea la operación con un mensaje
 * claro por audiencia: el admin sabe que debe hablar con SYNTRA; el alumno /
 * instructor ve una pausa temporal sin detalles comerciales.
 */
export function SuspendedScreen({
  studioName,
  audience,
}: {
  studioName: string;
  audience: "admin" | "member";
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-6">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-raised">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-warning/15 text-warning">
          <PauseCircle className="size-7" aria-hidden />
        </span>
        <h1 className="mt-4 text-xl font-bold tracking-tight text-foreground">
          {studioName} está suspendido
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {audience === "admin"
            ? "El acceso al panel está pausado. Contactá a SYNTRA para reactivar tu estudio."
            : "El estudio está temporalmente inactivo. Ante cualquier duda, hablá directamente con tu estudio."}
        </p>
        <a
          href="/logout"
          className="mt-6 inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
        >
          <LogOut className="size-4" aria-hidden />
          Cerrar sesión
        </a>
      </div>
    </main>
  );
}
