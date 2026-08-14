import type { CSSProperties } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import { Zap, PackageCheck, NotebookPen, Info, Store } from "lucide-react";
import { getSession } from "@/lib/session";
import { textoDelMotivo } from "@/lib/motivos";
import { Wordmark } from "@/components/brand/logo";
import { LogoMark3D } from "@/components/brand/logo-3d";
import { LoginForm } from "./login-form";
import { COOKIE_KIOSCO, COOKIE_KIOSCO_NOMBRE } from "./cookies";
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

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    motivo?: string;
    error?: string;
    como?: string;
    k?: string;
    cambiar?: string;
  }>;
}) {
  // Ya logueado: no tiene sentido mostrarle el formulario.
  const session = await getSession();
  if (session) redirect("/");

  const sp = await searchParams;

  /* 050 · EL MODO LO DECIDE EL DISPOSITIVO, NO LA PERSONA.
     El terminal del mostrador es siempre del empleado; el celular del dueño es
     siempre suyo. Un solo dato recordado (el kiosco, en cookie) resuelve las
     dos identidades sin que nadie elija nada en la enorme mayoría de los
     logins. Y como la cookie la lee el SERVER, el primer paint ya sale en el
     modo correcto: sin flash, sin salto, sin mismatch de hidratación. */
  const ck = await cookies();
  const recordado = sp.cambiar ? null : (sp.k ?? ck.get(COOKIE_KIOSCO)?.value ?? null);
  const nombreKiosco = sp.k ? null : (ck.get(COOKIE_KIOSCO_NOMBRE)?.value ?? null);

  const modo: "duenio" | "empleado" =
    sp.como === "empleado" || sp.cambiar
      ? "empleado"
      : sp.como === "duenio"
        ? "duenio"
        : recordado
          ? "empleado"
          : /* Un dispositivo sin memoria arranca en modo dueño: en la práctica
               el primer login de cualquier equipo es el suyo. */
            "duenio";

  const slug = modo === "empleado" && !sp.cambiar ? (recordado ?? undefined) : undefined;
  /* El proxy manda `?error=` cuando el proveedor de auth se cae; hasta la 049
     esta página no leía searchParams y ese aviso NUNCA se mostraba. */
  const aviso = textoDelMotivo(sp.motivo) ?? sp.error ?? null;

  return (
    <main className="flex min-h-dvh flex-col md:grid md:grid-cols-2">
      {/* ── Panel de marca a sangre ── */}
      {/* 050 · `dvh`, no `vh`: era el ÚNICO `vh` de la app. En Android `38vh` mide
          contra el viewport GRANDE (barra de URL retraída), así que la banda salía
          más alta que lo medido; y con `dvh` se achica sola al abrir el teclado y le
          devuelve el espacio al formulario. El `min-h-[240px]` es GEOMETRÍA, no
          gusto: por debajo de ~225px el lienzo empieza a comerse la pantalla viva de
          la notebook, que es la firma del login. No bajarlo. */}
      <section className="relative h-[30dvh] min-h-[240px] overflow-hidden md:h-auto">
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
        className="flex flex-1 flex-col justify-center gap-8 px-6 py-8 sm:px-10 md:justify-between md:gap-6 md:py-10 lg:px-16 lg:py-12"
      >
        {/* Headline arriba del form (tablet+): el mensaje de producto vive de
            este lado; la marca quedó abajo-izquierda sobre la foto (pedido
            owner 2026-07-23). Tamaño contenido para no competir con el h1. */}
        {/* El pitch de escritorio pide ALTO, no sólo ancho: en un 1366×768 o un
            1280×800 (o un 1920 con la barra de tareas y el chrome del
            navegador) sus 195px eran justo lo que hacía scrollear la pantalla.
            Con alto de sobra aparece; sin él, el formulario queda limpio. */}
        <div className="hidden duration-700 animate-in fade-in slide-in-from-top-3 [@media(min-width:768px)_and_(min-height:820px)]:block">
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
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Entrá a tu negocio</h1>
          {/* El pitch es para el dueño. En el terminal del mostrador el empleado
              ya está adentro: ahí es pantalla de trabajo, no de marketing. */}
          {modo === "duenio" && (
            <p className="mt-1.5 text-sm text-muted-foreground">
              Tu stock, tus ventas y tu fiado en una pantalla.
            </p>
          )}
          {aviso && (
            /* Va ARRIBA del form y no adentro: no es un error de lo que el
               usuario acaba de tipear, es el estado de su cuenta. Ámbar y no
               rojo — no hizo nada mal. */
            <p
              role="status"
              className="mt-5 flex items-start gap-2 rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning-ink ring-1 ring-warning/25"
            >
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
              {aviso}
            </p>
          )}
          {/* Chip de MEMORIA, no etiqueta de modo: sólo aparece cuando el
              terminal ya recuerda el negocio, porque ahí informa algo que el
              usuario no tipeó. Decir "entrás como empleado" repetía lo que ya
              dicen los propios campos y el link de abajo — 60px que no
              informaban nada. Lee como chip, no como card (el lock rechazó la
              caja flotante). */}
          {modo === "empleado" && slug && (
            <div className="mt-5 flex h-10 items-center justify-between gap-3 rounded-xl border border-border/70 bg-secondary/60 px-3">
              <p className="flex min-w-0 items-center gap-2 text-sm">
                <Store className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="truncate font-medium">{nombreKiosco ?? slug}</span>
              </p>
              <Link
                href="/login?cambiar=1"
                className="-my-2 shrink-0 rounded-lg px-2 py-2.5 text-xs font-medium text-primary-ink transition-colors hover:bg-accent"
              >
                No es acá
              </Link>
            </div>
          )}

          <div className="mt-5">
            <LoginForm modo={modo} slug={slug} />
          </div>

          {/* Cambiar de identidad, debajo del botón: el frecuente no lo toca. */}
          <p className="mt-4 text-center text-xs">
            <Link
              href={modo === "empleado" ? "/login?como=duenio" : "/login?como=empleado"}
              className="text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
            >
              {modo === "empleado" ? "Soy el dueño" : "Trabajo acá, entrar con usuario"}
            </Link>
          </p>
        </div>

        {/* perks + footer */}
        <div className="mx-auto w-full max-w-sm">
          {/* En mobile los perks se comprimen: en modo empleado desaparecen (el
              terminal del mostrador ya es cliente, nadie decide comprar ahí) y
              en modo dueño quedan en una línea. Desde md vuelve la grilla
              completa del lock. */}
          {modo === "duenio" && (
            <p className="text-center text-[11px] text-muted-foreground md:hidden">
              Vendés en segundos · Stock al día · Fiado bajo control
            </p>
          )}
          <ul className="hidden grid-cols-3 gap-2 md:grid">
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
          <p className="mt-4 text-center text-xs text-muted-foreground md:mt-6">
            StockFlow · un producto de SYNTRA
          </p>
        </div>
      </section>
    </main>
  );
}
