import type { CSSProperties } from "react";
import { redirect } from "next/navigation";
import { Zap, PackageCheck, NotebookPen } from "lucide-react";
import { getSession } from "@/lib/session";
import { Wordmark } from "@/components/brand/logo";
import { LogoMark3D } from "@/components/brand/logo-3d";
import { LoginForm } from "./login-form";
import { ScreenOverlay } from "./screen-overlay";

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
        {/* Dos capas: blur-up de la imagen al montar y la pantalla de la
            notebook en uso (ScreenOverlay), anclada al mismo lienzo que la
            imagen para que se recorten juntas. Sin Ken Burns: mantener el
            lienzo estático es lo que permite que el texto de la pantalla
            rasterice nítido. */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="sf-hero-canvas">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={BG}
              alt=""
              aria-hidden
              className="sf-hero-img absolute inset-0 size-full"
            />
            <ScreenOverlay />
          </div>
        </div>
        {/* Gradiente inferior suave (funde con el fondo sin tapar la escena) y
            la marca abajo a la izquierda, discreta: el headline se mudó al
            panel del formulario (pedido owner 2026-07-23). */}
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/25 to-background/5" />
        <div className="absolute inset-x-0 bottom-0 p-6 duration-700 animate-in fade-in slide-in-from-bottom-3 sm:p-8 md:p-10 lg:p-12">
          <div className="inline-flex items-center gap-3">
            <LogoMark3D className="size-12" />
            <div>
              <Wordmark className="text-lg text-foreground" />
              <p className="text-xs text-muted-foreground">Stock y ventas para tu negocio</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Lado del formulario ── */}
      <section
        style={ambient}
        className="flex flex-1 flex-col justify-center gap-10 px-6 py-10 sm:px-10 md:justify-between md:gap-8 md:py-12 lg:px-16 lg:py-14"
      >
        {/* Headline arriba del form (tablet+): el mensaje de producto vive de
            este lado; la marca quedó abajo-izquierda sobre la foto (pedido
            owner 2026-07-23). Tamaño contenido para no competir con el h1. */}
        <div className="hidden duration-700 animate-in fade-in slide-in-from-top-3 md:block">
          <div className="mb-5 flex items-center gap-3">
            <LogoMark3D className="size-11" />
            <Wordmark className="text-2xl text-foreground" />
          </div>
          <h2 className="max-w-md text-2xl font-bold leading-tight tracking-tight text-foreground lg:text-3xl">
            Todo tu inventario,
            <br />
            en un solo lugar.
          </h2>
          <p className="mt-2.5 max-w-md text-sm leading-relaxed text-muted-foreground">
            Lo que se vende, lo que falta, lo que vence y lo que te deben — en
            una pantalla que trabaja sola.
          </p>
        </div>

        {/* form */}
        <div className="mx-auto w-full max-w-sm duration-500 animate-in fade-in slide-in-from-bottom-2">
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
