import { LogIn } from "lucide-react";

/**
 * Login — shell visual (tanda 1A).
 * El cableado real (server action + Supabase auth + rate limit + ruteo por rol:
 * owner → /admin, staff → /pos) entra en la tanda 1B, cuando exista el proyecto
 * de Supabase y la tabla `members`.
 */
export default function LoginPage() {
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 grid size-12 place-items-center rounded-xl bg-primary text-lg font-bold text-primary-foreground">
            SF
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Entrá a tu negocio</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tu stock, tus ventas y tu fiado en una pantalla.
          </p>
        </div>

        <form className="space-y-4 rounded-xl border border-border bg-card p-5">
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="vos@tunegocio.com"
              className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium">
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary"
            />
          </div>

          <button
            type="submit"
            className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-opacity duration-150 hover:opacity-90"
          >
            <LogIn className="size-4" />
            Entrar
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          StockFlow · un producto de SYNTRA
        </p>
      </div>
    </main>
  );
}
