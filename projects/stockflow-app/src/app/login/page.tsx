import type { CSSProperties } from "react";
import { redirect } from "next/navigation";
import { Zap, PackageCheck, NotebookPen } from "lucide-react";
import { getSession } from "@/lib/session";
import { Wordmark } from "@/components/brand/logo";
import { LogoMark3D } from "@/components/brand/logo-3d";
import { LoginForm } from "./login-form";

/* Split panel (patrón StudioFlow login v2, adaptado a dark): banda de imagen
   arriba en el teléfono, media pantalla desde tablet. El overlay va HACIA
   --background (#0A0D13) y no hacia foreground como en StudioFlow — acá
   foreground es casi blanco y lavaría la foto en vez de fundirla. */
const BG = "/login-hero.jpg";

// Glow ambiental del lado del form, token-driven → white-label safe.
const ambient: CSSProperties = {
  backgroundImage:
    "radial-gradient(42rem 34rem at 85% -8%, color-mix(in srgb, var(--primary) 10%, transparent), transparent 60%)",
};

const PERKS = [
  { icon: Zap, label: "Vendés\nen segundos" },
  { icon: PackageCheck, label: "Stock siempre\nal día" },
  { icon: NotebookPen, label: "El fiado\nbajo control" },
];

export default async function LoginPage() {
  // Ya logueado: no tiene sentido mostrarle el formulario.
  const session = await getSession();
  if (session) redirect("/");

  return (
    <main className="flex min-h-dvh flex-col md:grid md:grid-cols-2">
      {/* ── Panel de marca a sangre ── */}
      <section className="relative h-[38vh] min-h-[240px] overflow-hidden md:h-auto">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={BG}
          alt=""
          aria-hidden
          className="absolute inset-0 size-full object-cover object-bottom"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/40 to-background/10" />
        <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8 md:p-10 lg:p-12">
          <div className="inline-flex items-center gap-3">
            <LogoMark3D className="size-14" />
            <div>
              <Wordmark className="text-lg text-foreground" />
              <p className="text-xs text-muted-foreground">Stock y ventas para tu negocio</p>
            </div>
          </div>
          <h2 className="mt-5 hidden max-w-md text-3xl font-bold leading-tight tracking-tight text-foreground md:block lg:text-4xl">
            Todo tu inventario,
            <br />
            en un solo lugar.
          </h2>
          <p className="mt-3 hidden max-w-md text-sm leading-relaxed text-muted-foreground md:block">
            Lo que se vende, lo que falta, lo que vence y lo que te deben — en una
            pantalla que trabaja sola.
          </p>
        </div>
      </section>

      {/* ── Lado del formulario ── */}
      <section
        style={ambient}
        className="flex flex-1 flex-col justify-center gap-10 px-6 py-10 sm:px-10 md:justify-between md:gap-8 md:py-12 lg:px-16 lg:py-14"
      >
        {/* ancla de marca (tablet+) — 3D y con presencia: es la única marca
           visible de este lado y la sección es grande (pedido owner 2026-07-22) */}
        <div className="hidden items-center gap-3.5 md:flex">
          <LogoMark3D className="size-12" />
          <Wordmark className="text-2xl text-foreground" />
        </div>

        {/* form */}
        <div className="mx-auto w-full max-w-sm">
          <h1 className="text-3xl font-bold tracking-tight">Entrá a tu negocio</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Tu stock, tus ventas y tu fiado en una pantalla.
          </p>
          <div className="mt-6">
            <LoginForm />
          </div>
        </div>

        {/* perks + footer */}
        <div className="mx-auto w-full max-w-sm">
          <ul className="grid grid-cols-3 gap-2">
            {PERKS.map((p) => (
              <li key={p.label} className="flex flex-col items-center gap-1.5 text-center">
                <span className="flex size-8 items-center justify-center rounded-full bg-accent text-primary-ink">
                  <p.icon className="size-4" aria-hidden />
                </span>
                <span className="whitespace-pre-line text-[11px] leading-tight text-muted-foreground">
                  {p.label}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-center text-xs text-muted-foreground">
            StockFlow · un producto de SYNTRA
          </p>
        </div>
      </section>
    </main>
  );
}
