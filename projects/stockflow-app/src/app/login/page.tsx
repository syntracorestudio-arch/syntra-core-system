import type { CSSProperties } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import { Zap, PackageCheck, NotebookPen, Info } from "lucide-react";
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
  /* El nombre se anula cuando el negocio viene por `?k=` porque la cookie
     podría ser de OTRO negocio y mostrar el nombre equivocado sería peor que
     mostrar el código. Pero si la cookie coincide con el slug del link, el
     nombre SÍ es el de ese negocio: mostrarlo evita el caso más feo del primer
     día de un empleado —el dueño le pasa el link y la pantalla le contesta
     `el-trebol` en minúsculas y con guión. */
  const nombreCookie = ck.get(COOKIE_KIOSCO_NOMBRE)?.value ?? null;
  const slugCookie = ck.get(COOKIE_KIOSCO)?.value ?? null;
  const nombreKiosco = sp.k
    ? sp.k === slugCookie
      ? nombreCookie
      : null
    : nombreCookie;

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
      {/* En modo empleado y mobile son TRES campos + botón + el selector: con
          la banda de 30dvh el formulario quedaba apretado. Cede alto sólo en
          ese caso; el dueño (dos campos) la conserva.

          Y en pantallas BAJAS (≤700px de alto, tipo 360×640) cede más todavía:
          ahí la foto es atmósfera y el pie —que va a llevar la URL de SYNTRA—
          es marca, así que lo que se achica es la decoración, no el contenido.
          El recorte está acotado por altura: en 390×844 no cambia nada. */}
      <section
        className={
          modo === "empleado"
            ? "relative h-[22dvh] min-h-[170px] overflow-hidden [@media(max-height:700px)]:min-h-[128px] md:h-auto"
            : "relative h-[30dvh] min-h-[240px] overflow-hidden md:h-auto"
        }
      >
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
        className="flex flex-1 flex-col justify-center gap-8 px-6 py-8 [@media(max-height:700px)]:gap-5 [@media(max-height:700px)]:py-5 sm:px-10 md:justify-between md:gap-6 md:py-10 lg:px-16 lg:py-12"
      >
        {/* Headline arriba del form (tablet+): el mensaje de producto vive de
            este lado; la marca quedó abajo-izquierda sobre la foto (pedido
            owner 2026-07-23). Tamaño contenido para no competir con el h1. */}
        {/* El pitch de escritorio pide ALTO, no sólo ancho: en un 1366×768 o un
            1280×800 (o un 1920 con la barra de tareas y el chrome del
            navegador) sus 195px eran justo lo que hacía scrollear la pantalla.
            Con alto de sobra aparece; sin él, el formulario queda limpio. */}
        {/* Comparte columna con el form (`max-w-sm` centrado) y no el borde del
            panel: con `px-16` el pitch arrancaba en un eje y el form en otro, y
            a 1920 —donde el panel mide 960— ese desfase de ~220px se lee como
            descuido. Una sola columna para pitch, form y pie.

            820px de alto dejaba esto INVISIBLE en 1440×900 con la barra del
            navegador (~780 útiles): el lado derecho quedaba hueco arriba en la
            resolución de escritorio más común. 760 lo devuelve sin que aparezca
            en pantallas donde el form no entraría. */}
        <div className="mx-auto hidden w-full max-w-sm duration-700 animate-in fade-in slide-in-from-top-3 [@media(min-width:768px)_and_(min-height:760px)]:block">
          <div className="mb-5 flex items-center gap-3">
            <LogoMark3D className="size-11" />
            <Wordmark className="text-2xl text-foreground" />
          </div>
          <h2 className="text-2xl font-bold leading-tight tracking-tight text-foreground lg:text-3xl">
            Todo tu inventario,
            <br />
            en un solo lugar.
          </h2>
          <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
            Lo que se vende, lo que falta, lo que vence y lo que te deben — en
            una pantalla que trabaja sola.
          </p>
        </div>

        {/* form */}
        {/* 300ms y no 500: el que viene a tipear su clave no espera a que el
            campo termine de aparecer. El panel de marca sí conserva 700 —
            es lienzo, no tarea. */}
        <div className="mx-auto w-full max-w-sm duration-300 animate-in fade-in slide-in-from-bottom-2">
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
          {/* Elegir identidad ARRIBA del form y no en un link de 12px al pie.
              Antes había que leer hasta abajo para descubrir que existía otra
              forma de entrar; el empleado nuevo, que es el que menos sabe, era
              el que peor la tenía. Las etiquetas dicen lo que la persona ES
              ("trabajo acá"), no cómo la llama el sistema ("empleado").

              Sigue siendo navegación de servidor: cero JS, cero flash, y la
              página se renderiza directamente en el modo correcto. */}
          <div className="mt-5 grid h-10 grid-cols-2 gap-1 rounded-xl bg-secondary/60 p-1">
            {([
              { m: "duenio", label: "Soy el dueño" },
              { m: "empleado", label: "Trabajo acá" },
            ] as const).map((o) => (
              <Link
                key={o.m}
                href={`/login?como=${o.m}`}
                aria-current={modo === o.m ? "page" : undefined}
                className={
                  modo === o.m
                    ? "grid place-items-center rounded-lg bg-card text-sm font-medium text-foreground shadow-[inset_0_1px_0_rgb(255_255_255/.06)]"
                    : "grid place-items-center rounded-lg text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground"
                }
              >
                {o.label}
              </Link>
            ))}
          </div>

          <div className="mt-4">
            <LoginForm modo={modo} slug={slug} nombreKiosco={nombreKiosco} />
          </div>

          {/* "Me olvidé" SÓLO en modo dueño: el empleado no tiene email y su
              camino es pedirle al dueño que se la resetee. Ofrecérselo acá lo
              mandaría a una pantalla que sólo puede decirle que no. */}
          {modo !== "empleado" && (
            <p className="mt-4 text-center text-xs">
              <Link
                href="/recuperar"
                className="text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
              >
                Me olvidé la contraseña
              </Link>
            </p>
          )}

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
