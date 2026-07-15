import type { CSSProperties } from "react";
import Link from "next/link";
import { CalendarCheck, Mail, Lock, AlertCircle, KeyRound, CreditCard, Store } from "lucide-react";
import { login, loginWithGoogle } from "./actions";
import { LoginSubmit } from "./submit-button";
import { buttonClass } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";

/** Logo G multicolor de Google (lucide no lo trae; SVG oficial simplificado). */
function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.46a5.53 5.53 0 0 1-2.4 3.62v3h3.88c2.27-2.1 3.56-5.17 3.56-8.81Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3c-1.08.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.72-4.96H1.27v3.1A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.28a7.2 7.2 0 0 1 0-4.56v-3.1H1.27a12 12 0 0 0 0 10.76l4.01-3.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.76c1.76 0 3.35.6 4.6 1.8l3.44-3.44A11.97 11.97 0 0 0 12 0 12 12 0 0 0 1.27 6.62l4.01 3.1C6.22 6.87 8.87 4.76 12 4.76Z"
      />
    </svg>
  );
}
import { siteConfig } from "@/config/site";

export const metadata = { title: "Ingresar" };

// Imagen del panel de marca (full-bleed): estudio real con reformers de madera (988×1280).
const BG = "/login-bg.jpg";

// Calidez ambiental del lado del formulario (token-driven → respeta white-label).
const ambient: CSSProperties = {
  backgroundImage:
    "radial-gradient(42rem 34rem at 85% -8%, color-mix(in srgb, var(--primary) 10%, transparent), transparent 60%)",
};

const PERKS = [
  { icon: CalendarCheck, label: "Reservás\nen dos toques" },
  { icon: CreditCard, label: "Tu saldo\nsiempre al día" },
  { icon: Store, label: "Con la marca\nde tu estudio" },
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-dvh flex-col md:grid md:grid-cols-2">
      {/* ── Panel de marca a sangre (banda superior en celular, media pantalla desde tablet) ── */}
      <section className="relative h-[38vh] min-h-[240px] overflow-hidden md:h-auto">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={BG}
          alt=""
          aria-hidden
          className="absolute inset-0 size-full object-cover object-[center_90%] md:object-bottom"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-foreground/30 to-foreground/5" />
        <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8 md:p-10 lg:p-12">
          <div className="inline-flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-white/15 text-white ring-1 ring-white/30 backdrop-blur">
              <CalendarCheck className="size-5" aria-hidden />
            </span>
            <div>
              <p className="text-lg font-bold tracking-tight text-white">{siteConfig.name}</p>
              <p className="text-xs text-white/70">Reservas y cobranza · white-label</p>
            </div>
          </div>
          <h2 className="mt-5 hidden max-w-md text-3xl font-bold leading-tight tracking-tight text-white md:block lg:text-4xl">
            Tu estudio, en una app.
          </h2>
          <p className="mt-3 hidden max-w-md text-sm leading-relaxed text-white/85 md:block">
            Reservas sin sobrecupo, saldos al día y tu agenda en un solo lugar — con la marca de tu estudio.
          </p>
        </div>
      </section>

      {/* ── Lado del formulario: ancla de marca · form + acceso por código · features + footer ── */}
      <section
        style={ambient}
        className="flex flex-1 flex-col justify-center gap-10 px-6 py-12 sm:px-10 md:justify-between md:gap-8 md:px-10 md:py-12 lg:px-16 lg:py-14"
      >
        {/* ancla de marca (tablet+) */}
        <div className="hidden items-center gap-2.5 md:flex">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <CalendarCheck className="size-4" aria-hidden />
          </span>
          <span className="text-sm font-bold tracking-tight text-foreground">{siteConfig.name}</span>
        </div>

        {/* form */}
        <div className="mx-auto w-full max-w-sm">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Ingresar</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Accedé a la app de tu estudio.</p>

          {error ? (
            <p
              role="alert"
              className="mt-5 flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              <AlertCircle className="size-4 shrink-0" aria-hidden />
              {error}
            </p>
          ) : null}

          <form action={login} className="mt-6 grid gap-4">
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

            <label className="grid gap-1.5 text-sm">
              <span className="flex items-center justify-between font-medium text-foreground">
                Contraseña
                <Link
                  href="/recuperar"
                  className="text-xs font-medium text-muted-foreground transition-colors hover:text-primary-ink"
                >
                  ¿la olvidaste?
                </Link>
              </span>
              <PasswordInput
                name="password"
                placeholder="••••••••"
                autoComplete="current-password"
                inputClassName="w-full rounded-xl border border-input bg-card py-2.5 pl-10 pr-11 text-foreground outline-none transition-base placeholder:text-muted-foreground/60 focus:border-transparent focus:ring-2 focus:ring-ring"
                leadingIcon={
                  <Lock className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                }
              />
            </label>

            <LoginSubmit />
          </form>

          {/* Google OAuth */}
          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            o
            <span className="h-px flex-1 bg-border" />
          </div>
          <form action={loginWithGoogle}>
            <button type="submit" className={buttonClass("secondary", "md", "w-full")}>
              <GoogleIcon />
              Continuar con Google
            </button>
          </form>

          {/* alta por código del estudio */}
          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            ¿primera vez?
            <span className="h-px flex-1 bg-border" />
          </div>
          <Link href="/join" className={buttonClass("secondary", "md", "w-full")}>
            <KeyRound className="size-4" aria-hidden />
            Crear mi cuenta con el código del estudio
          </Link>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            El código te lo da tu estudio — así tu cuenta queda vinculada a él.
          </p>
        </div>

        {/* features + footer */}
        <div className="mx-auto w-full max-w-sm">
          <ul className="grid grid-cols-3 gap-2">
            {PERKS.map((p) => {
              const Icon = p.icon;
              return (
                <li key={p.label} className="flex flex-col items-center gap-1.5 text-center">
                  <span className="flex size-8 items-center justify-center rounded-full bg-accent text-primary">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span className="whitespace-pre-line text-[11px] leading-tight text-muted-foreground">{p.label}</span>
                </li>
              );
            })}
          </ul>
          <p className="mt-6 text-center text-xs text-muted-foreground">Provisto y mantenido por SYNTRA</p>
        </div>
      </section>
    </main>
  );
}
