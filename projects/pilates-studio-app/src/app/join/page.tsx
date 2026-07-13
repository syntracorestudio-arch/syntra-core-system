import { join } from "./actions";
import { PasswordInput } from "@/components/ui/password-input";

export const metadata = { title: "Sumate a tu estudio" };

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Sumate a tu estudio
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ingresá el código que te dio tu estudio para crear tu cuenta.
        </p>

        {error ? (
          <p
            role="alert"
            className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        ) : null}

        <form action={join} className="mt-6 grid gap-4">
          <Field label="Nombre" name="name" type="text" autoComplete="name" />
          <Field label="Email" name="email" type="email" autoComplete="email" />
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium text-foreground">Contraseña</span>
            <PasswordInput
              name="password"
              minLength={8}
              autoComplete="new-password"
              inputClassName="w-full rounded-md border border-input bg-card px-3 py-2 pr-11 text-foreground outline-none focus:ring-2 focus:ring-ring"
            />
            <span className="text-xs text-muted-foreground">Mínimo 8 caracteres.</span>
          </label>
          <Field
            label="Código del estudio"
            name="code"
            type="text"
            autoComplete="off"
          />
          <button
            type="submit"
            className="mt-2 rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground transition-colors hover:opacity-90"
          >
            Crear cuenta
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          ¿Ya tenés cuenta?{" "}
          <a href="/login" className="font-medium text-primary hover:underline">
            Ingresar
          </a>
        </p>
      </div>
    </main>
  );
}

function Field({
  label,
  name,
  type,
  autoComplete,
  hint,
}: {
  label: string;
  name: string;
  type: string;
  autoComplete: string;
  hint?: string;
}) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="font-medium text-foreground">{label}</span>
      <input
        type={type}
        name={name}
        required
        autoComplete={autoComplete}
        className="rounded-md border border-input bg-card px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-ring"
      />
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </label>
  );
}
