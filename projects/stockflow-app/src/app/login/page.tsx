import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  // Ya logueado: no tiene sentido mostrarle el formulario.
  const session = await getSession();
  if (session) redirect("/");

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

        <LoginForm />

        <p className="mt-6 text-center text-xs text-muted-foreground">
          StockFlow · un producto de SYNTRA
        </p>
      </div>
    </main>
  );
}
