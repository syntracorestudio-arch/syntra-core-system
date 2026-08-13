import type { CSSProperties } from "react";
import { redirect } from "next/navigation";
import { KeyRound } from "lucide-react";
import { getSession } from "@/lib/session";
import { Wordmark } from "@/components/brand/logo";
import { LogoMark3D } from "@/components/brand/logo-3d";
import { ClaveForm } from "./clave-form";

export const dynamic = "force-dynamic";

/** Mismo glow del login: un solo vocabulario visual para las pantallas de acceso. */
const ambient: CSSProperties = {
  backgroundImage:
    "radial-gradient(42rem 34rem at 85% -8%, color-mix(in srgb, var(--primary) 10%, transparent), transparent 60%)",
};

/**
 * Cambio obligatorio de la credencial de alta.
 *
 * No usa `requireSession()` a propósito: esa guarda redirige ACÁ cuando el flag
 * está encendido, y llamarla desde esta página sería un bucle. Rehace el
 * mínimo (hay sesión + el flag sigue prendido) y nada más.
 */
export default async function ClavePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.mustChangePassword) redirect("/");

  return (
    /* El glow ambiental es el MISMO del login (token-driven ⇒ white-label safe):
       sin él, a 1920 la pantalla era un formulario flotando en un vacío negro y
       parecía de otro producto. La card le da superficie sin traer el panel de
       marketing, que acá no corresponde: esto es un trámite de un solo uso. */
    <main style={ambient} className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-3">
          <LogoMark3D className="size-10" />
          <Wordmark className="text-base text-foreground" />
        </div>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] duration-500 animate-in fade-in slide-in-from-bottom-2 sm:p-8">
          <span
            aria-hidden
            className="mb-4 grid size-11 place-items-center rounded-xl bg-primary/15 text-primary-ink ring-1 ring-primary/25"
          >
            <KeyRound className="size-5" />
          </span>

          <h1 className="text-2xl font-bold tracking-tight">Elegí tu contraseña</h1>
          <p className="mt-1 mb-6 text-sm text-muted-foreground">
            La que te dimos era provisoria y la vio quien te dio de alta. Poné una
            tuya y seguimos.
          </p>

          <ClaveForm />
        </section>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          StockFlow · un producto de SYNTRA
        </p>
      </div>
    </main>
  );
}
