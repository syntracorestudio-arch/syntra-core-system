import { redirect } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { getSession } from "@/lib/session";
import { esEmailSintetico } from "@/lib/credenciales";
import { CuentaForm } from "./cuenta-form";

export const dynamic = "force-dynamic";

/**
 * Tu cuenta: cambiar la propia contraseña cuando quieras.
 *
 * No usa `requireSession()` a propósito. Esa guarda rebota a `/clave` cuando
 * `must_change_password` sigue prendido, y el que llega por el link de
 * recuperación llega justamente con el flag puesto: lo mandaría a la pantalla
 * de al lado a hacer exactamente esto. Se rehace el mínimo (hay sesión) y la
 * acción apaga el flag al guardar.
 */
export default async function CuentaPage({
  searchParams,
}: {
  searchParams: Promise<{ listo?: string; nueva?: string }>;
}) {
  const sp = await searchParams;
  const session = await getSession();
  if (!session) redirect("/login");

  const listo = sp.listo === "1";
  const desdeLink = sp.nueva === "1";
  const email = session.email ?? "";
  const sintetico = esEmailSintetico(email);

  return (
    <AppShell
      current="/cuenta"
      storeName={session.store.name}
      userLabel={`${session.member.display_name ?? "Vos"} · ${
        session.member.role === "owner" ? "Dueño" : "Empleado"
      }`}
    >
      <div className="mx-auto max-w-xl px-4 py-6 lg:px-8 lg:py-8">
        <h1 className="text-2xl font-bold tracking-tight">Tu cuenta</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {/* Al empleado se le muestra su USUARIO, no el email sintético: ese
              string lo fabricó el sistema y no significa nada para él. */}
          {sintetico ? (
            <>
              Entrás como <span className="text-foreground">{session.member.usuario ?? "tu usuario"}</span> en{" "}
              {session.store.name}.
            </>
          ) : (
            <>
              Entrás con <span className="text-foreground">{email}</span>.
            </>
          )}
        </p>

        {listo && (
          <p
            role="status"
            className="mt-5 flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success-ink"
          >
            <CheckCircle2 className="size-4 shrink-0" aria-hidden />
            Listo, tu contraseña quedó cambiada.
          </p>
        )}

        <section className="mt-6 rounded-2xl border border-border bg-card p-6">
          <h2 className="font-semibold">
            {desdeLink ? "Elegí tu contraseña nueva" : "Cambiar la contraseña"}
          </h2>
          <p className="mt-1 mb-5 text-sm text-muted-foreground">
            {desdeLink
              ? "Entraste con el link del correo. Poné una contraseña y ya queda tuya."
              : "Si creés que alguien más la sabe, cambiala acá mismo."}
          </p>
          <CuentaForm />
        </section>
      </div>
    </AppShell>
  );
}
