import type { CSSProperties } from "react";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { Wordmark } from "@/components/brand/logo";
import { LogoMark3D } from "@/components/brand/logo-3d";
import { RecuperarForm } from "./recuperar-form";

export const dynamic = "force-dynamic";

/** Mismo glow del login y de /clave: un solo vocabulario para las pantallas de acceso. */
const ambient: CSSProperties = {
  backgroundImage:
    "radial-gradient(42rem 34rem at 85% -8%, color-mix(in srgb, var(--primary) 10%, transparent), transparent 60%)",
};

export default async function RecuperarPage({
  searchParams,
}: {
  searchParams: Promise<{ enviado?: string }>;
}) {
  const sp = await searchParams;
  const enviado = sp.enviado === "1";

  return (
    <main style={ambient} className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-3">
          <LogoMark3D className="size-10" />
          <Wordmark className="text-base text-foreground" />
        </div>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-elev-0 duration-500 animate-in fade-in slide-in-from-bottom-2 sm:p-8">
          {enviado ? (
            <>
              <div className="mb-4 grid size-11 place-items-center rounded-xl bg-primary/15 ring-1 ring-primary/25">
                <MailCheck className="size-5 text-primary-ink" aria-hidden />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">Revisá tu correo</h1>
              {/* Se afirma en condicional ("si ese email…") a propósito: confirmar
                  que la cuenta existe convertiría esta pantalla en un verificador
                  de qué clientes tenemos. El texto tiene que ser el mismo tanto si
                  el mail salió como si no. */}
              <p className="mt-2 text-sm text-muted-foreground">
                Si ese email tiene una cuenta, te llega un link para poner una contraseña
                nueva. Dura una hora y se usa una sola vez.
              </p>
              <p className="mt-4 text-sm text-muted-foreground">
                ¿No llegó? Fijate en spam, o{" "}
                <Link href="/recuperar" className="cursor-pointer text-foreground underline">
                  pedí otro
                </Link>
                .
              </p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold tracking-tight">¿Olvidaste tu contraseña?</h1>
              <p className="mt-1 mb-6 text-sm text-muted-foreground">
                Poné tu email y te mandamos un link para elegir una nueva.
              </p>
              <RecuperarForm />
            </>
          )}

          <p className="mt-6 border-t border-border pt-4 text-center text-sm text-muted-foreground">
            <Link href="/login" className="cursor-pointer text-foreground underline">
              Volver a entrar
            </Link>
          </p>
        </section>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          StockFlow · un producto de SYNTRA
        </p>
      </div>
    </main>
  );
}
