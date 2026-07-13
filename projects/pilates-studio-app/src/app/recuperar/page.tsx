import Link from "next/link";
import { ArrowLeft, Mail, MailCheck, AlertCircle } from "lucide-react";
import { requestPasswordReset } from "./actions";
import { SendButton } from "./send-button";

export const metadata = { title: "Recuperar contraseña" };

export default async function RecuperarPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const { sent, error } = await searchParams;

  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <Link
          href="/login"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Volver a ingresar
        </Link>

        <h1 className="mt-4 text-2xl font-bold tracking-tight text-foreground">Recuperar contraseña</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Te mandamos un link a tu email para que crees una contraseña nueva.
        </p>

        {sent ? (
          <div className="mt-6 rounded-2xl border border-success/30 bg-success/10 p-5">
            <p className="inline-flex items-center gap-2 text-sm font-medium text-success">
              <MailCheck className="size-4 shrink-0" aria-hidden />
              Si el email está registrado, ya te llegó el link.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Revisá spam si no lo ves. El link vence a la hora; podés pedir otro cuando quieras.
            </p>
          </div>
        ) : (
          <>
            {error ? (
              <p
                role="alert"
                className="mt-4 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                <AlertCircle className="size-4 shrink-0" aria-hidden />
                {error}
              </p>
            ) : null}

            <form action={requestPasswordReset} className="mt-6 grid gap-4">
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium text-foreground">Email</span>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  <input
                    type="email"
                    name="email"
                    required
                    autoComplete="email"
                    placeholder="tu@email.com"
                    className="w-full rounded-xl border border-input bg-card py-2.5 pl-10 pr-3 text-foreground outline-none transition-base placeholder:text-muted-foreground/60 focus:border-transparent focus:ring-2 focus:ring-ring"
                  />
                </div>
              </label>
              <SendButton />
            </form>
          </>
        )}
      </div>
    </main>
  );
}
