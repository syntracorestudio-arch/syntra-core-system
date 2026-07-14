import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, KeyRound, CheckCircle2, AlertCircle, UserRound } from "lucide-react";
import { createSupabaseServer } from "@/lib/supabase/server";
import { PasswordInput } from "@/components/ui/password-input";
import { changePassword } from "./actions";
import { SaveButton } from "./save-button";

export const metadata = { title: "Mi cuenta" };
export const dynamic = "force-dynamic";

const inputCls =
  "w-full rounded-xl border border-input bg-card px-3 py-2.5 pr-11 text-foreground outline-none transition-base placeholder:text-muted-foreground/60 focus:border-transparent focus:ring-2 focus:ring-ring";

/** Mi cuenta: datos básicos + cambio de contraseña. Accesible para CUALQUIER rol. */
export default async function CuentaPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const { notice, error } = await searchParams;
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Volver al panel que corresponda según el perfil.
  const [{ data: profile }, { data: member }] = await Promise.all([
    supabase.from("profiles").select("full_name, is_superadmin").eq("id", user.id).maybeSingle(),
    supabase.from("members").select("role").eq("profile_id", user.id).limit(1).maybeSingle(),
  ]);
  const backHref = profile?.is_superadmin
    ? "/super"
    : member?.role === "instructor"
      ? "/instructor"
      : member?.role === "admin" || member?.role === "reception"
        ? "/admin"
        : "/app";

  return (
    <main className="canvas-aurora mx-auto min-h-dvh w-full max-w-md px-5 pb-16 pt-8">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Volver
      </Link>

      <header className="mt-3 flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-2xl bg-accent text-primary-ink">
          <UserRound className="size-5" aria-hidden />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Mi cuenta</h1>
          <p className="text-sm text-muted-foreground">
            {profile?.full_name ?? ""} · {user.email}
          </p>
        </div>
      </header>

      {notice ? (
        <p className="mt-5 flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
          <CheckCircle2 className="size-4 shrink-0" aria-hidden />
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="mt-5 flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}

      <section className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="inline-flex items-center gap-1.5 text-base font-semibold text-foreground">
          <KeyRound className="size-4 text-muted-foreground" aria-hidden />
          Cambiar contraseña
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Si te dieron una clave temporal, cambiala acá por una tuya.
        </p>
        <form action={changePassword} className="mt-4 grid gap-4">
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium text-foreground">Contraseña nueva</span>
            <PasswordInput name="password" minLength={8} autoComplete="new-password" inputClassName={inputCls} />
            <span className="text-xs text-muted-foreground">Mínimo 8 caracteres.</span>
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium text-foreground">Repetir contraseña</span>
            <PasswordInput name="confirm" minLength={8} autoComplete="new-password" inputClassName={inputCls} />
          </label>
          <SaveButton />
        </form>
      </section>
    </main>
  );
}
