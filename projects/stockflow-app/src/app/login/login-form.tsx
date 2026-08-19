"use client";

import { useActionState, useState } from "react";
import {
  LogIn,
  LoaderCircle,
  TriangleAlert,
  Mail,
  Lock,
  Eye,
  EyeOff,
  User,
  Store,
} from "lucide-react";
import Link from "next/link";
import { signIn, type LoginState } from "./actions";

/* Form directo sobre el fondo (sin card con borde): en el split panel la caja
   flotante competía con el panel de imagen. Inputs con ícono leading, patrón
   StudioFlow, pero manteniendo h-11 (44px táctiles).

   050 · el form sirve a DOS identidades y sigue siendo tonto: el modo lo
   resuelve el server component y baja por prop, así el primer paint ya sale
   bien. Los `name` difieren por modo a propósito — en un terminal compartido,
   con los mismos nombres, el autofill del navegador mete el email del dueño en
   el campo del empleado. */
export function LoginForm({
  modo,
  slug,
  nombreKiosco,
}: {
  modo: "duenio" | "empleado";
  slug?: string;
  /* El nombre lindo del negocio recordado ("Kiosco El Trébol"). Puede faltar
     cuando el empleado llega por link: ahí se muestra el slug y NO se inventa
     un nombre. */
  nombreKiosco?: string | null;
}) {
  const [state, action, pending] = useActionState<LoginState, FormData>(signIn, {});
  const [verClave, setVerClave] = useState(false);
  const [fallos, setFallos] = useState(0);
  const empleado = modo === "empleado";

  return (
    <form
      action={async (fd) => {
        setFallos((n) => n + 1);
        return action(fd);
      }}
      className="space-y-4"
    >
      <input type="hidden" name="modo" value={modo} />

      {state.error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger-ink ring-1 ring-danger/25"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <span>
            {state.error}
            {/* Rescate del callejón sin salida SIN filtrar qué falló: se
                dispara por cantidad de intentos, no por la causa que devolvió
                el server. Resuelve el caso real —clave correcta, kiosco
                equivocado— que si no termina en una llamada al dueño. */}
            {/* Al PRIMER fallo y no al segundo: el caso real —clave correcta,
                negocio equivocado— no mejora haciéndole repetir el intento. */}
            {empleado && slug && fallos >= 1 && (
              <span className="mt-1 block text-xs">
                ¿Es este tu negocio? Tocá «Cambiar» para elegir otro.
              </span>
            )}
          </span>
        </p>
      )}

      {empleado && !slug && (
        <div className="space-y-1.5">
          {/* "Código del negocio" y no "Kiosco": StockFlow es white-label
              (`stores.vertical` = kiosco | dietetica | petshop | otro) y para un
              pet shop "Kiosco" es directamente falso. Y "código" en vez de
              "negocio" a secas porque lo que se tipea es el SLUG: mata el error
              nº1, que es escribir el nombre de fantasía ("El Trébol") en vez de
              `el-trebol`. El hint va en la MISMA fila del label — como <p>
              aparte costaba 22px de los que hacían scrollear la pantalla. */}
          <div className="flex items-baseline justify-between gap-2">
            <label htmlFor="kiosco" className="text-sm font-medium">
              Código del negocio
            </label>
            <span className="text-xs text-muted-foreground">te lo dice el dueño</span>
          </div>
          <div className="relative">
            <Store
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              id="kiosco"
              name="kiosco"
              required
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="el-trebol"
              className="h-11 w-full rounded-xl border border-input bg-card pl-10 pr-3 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-transparent focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
      )}
      {empleado && slug && (
        <div className="space-y-1.5">
          {/* LA MEMORIA VIVE ADENTRO DEL CAMPO QUE REEMPLAZA.
              Antes era un chip aparte con un link «No es acá»: una fila que se
              anunciaba a sí misma y una salida redactada como disculpa, sobre
              algo que el usuario nunca tipeó. Acá ocupa el lugar exacto del
              campo que se ahorró, con la misma altura y el mismo borde — se lee
              como "esto ya está resuelto", no como un cartel.

              El dato vale: en el terminal del mostrador evita que tres personas
              por turno tipeen un slug. Lo que estaba mal era la forma. */}
          <div className="flex items-baseline justify-between gap-2">
            <label className="text-sm font-medium">Negocio</label>
          </div>
          <div className="flex h-11 items-center gap-2 rounded-xl border border-transparent bg-secondary/60 pl-3 pr-1.5">
            <Store className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            {/* Si sólo hay slug, se muestra el slug en monoespaciada: es un
                código, y mostrarlo como tal evita que parezca un nombre mal
                escrito. Nunca se inventa el nombre. */}
            <span
              className={
                nombreKiosco
                  ? "min-w-0 flex-1 truncate text-sm text-foreground"
                  : "min-w-0 flex-1 truncate font-mono text-[13px] text-foreground"
              }
            >
              {nombreKiosco ?? slug}
            </span>
            <Link
              href="/login?cambiar=1"
              className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground"
            >
              Cambiar
            </Link>
          </div>
          <input type="hidden" name="kiosco" value={slug} />
        </div>
      )}

      <div className="space-y-1.5">
        <label htmlFor={empleado ? "usuario" : "email"} className="text-sm font-medium">
          {empleado ? "Usuario" : "Email"}
        </label>
        <div className="relative">
          {empleado ? (
            <User
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
          ) : (
            <Mail
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
          )}
          <input
            id={empleado ? "usuario" : "email"}
            name={empleado ? "usuario" : "email"}
            type={empleado ? "text" : "email"}
            autoComplete={empleado ? "username" : "email"}
            required
            /* Autofoco SÓLO en el mostrador: en el celular del dueño abrir el
               teclado de entrada tapa media pantalla. */
            autoFocus={empleado}
            autoCapitalize={empleado ? "none" : undefined}
            autoCorrect={empleado ? "off" : undefined}
            spellCheck={empleado ? false : undefined}
            /* No se limpia tras un error: retipear el usuario con la cola
               esperando es lo que hace que odien un POS. */
            defaultValue={empleado ? (state.usuario ?? "") : undefined}
            placeholder={empleado ? "sofia" : "vos@tunegocio.com"}
            className="h-11 w-full rounded-xl border border-input bg-card pl-10 pr-3 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-transparent focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="password" className="text-sm font-medium">
          Contraseña
        </label>
        <div className="relative">
          <Lock
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            id="password"
            name="password"
            type={verClave ? "text" : "password"}
            autoComplete="current-password"
            required
            placeholder="••••••••"
            className="h-11 w-full rounded-xl border border-input bg-card pl-10 pr-11 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-transparent focus:ring-2 focus:ring-ring"
          />
          <button
            type="button"
            onClick={() => setVerClave((v) => !v)}
            aria-label={verClave ? "Ocultar contraseña" : "Mostrar contraseña"}
            className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 cursor-pointer place-items-center rounded-lg text-muted-foreground transition-colors hover:text-foreground"
          >
            {verClave ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pending ? <LoaderCircle className="size-4 animate-spin" /> : <LogIn className="size-4" />}
        Entrar
      </button>
    </form>
  );
}
