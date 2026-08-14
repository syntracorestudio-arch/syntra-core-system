"use client";

import { useActionState, useState } from "react";
import { KeyRound, LoaderCircle, TriangleAlert, Lock, Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { cambiarMiClave, type ClaveState } from "./actions";

const MINIMO = 8;

/**
 * Un solo campo con «mostrar», y «Repetila» sólo para el dueño.
 *
 * El "repetir" existe para cachar un typo en un valor que NO ves; si lo podés
 * ver, sobra — y acá cada toque de más lo paga alguien con la cola esperando.
 * Para el empleado el costo de equivocarse está acotado: el dueño le resetea la
 * clave desde Equipo y está al lado.
 *
 * Para el DUEÑO la asimetría es deliberada: **todavía no existe `/recuperar`**,
 * así que un typo en su clave nueva lo deja afuera sin ningún camino dentro del
 * producto. Ahí el campo extra es seguro barato.
 * TODO: cuando exista `/recuperar` (bloque B2), este campo se borra.
 */
export function ClaveForm({ pideRepetir }: { pideRepetir: boolean }) {
  const [state, action, pending] = useActionState<ClaveState, FormData>(cambiarMiClave, {});
  const [ver, setVer] = useState(false);
  const [valor, setValor] = useState("");

  const faltan = Math.max(0, MINIMO - valor.length);
  const listo = valor.length >= MINIMO;

  return (
    <form action={action} className="space-y-4">
      {state.error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger-ink ring-1 ring-danger/25"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          {state.error}
        </p>
      )}

      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <label htmlFor="password" className="text-sm font-medium">
            Tu contraseña
          </label>
          <button
            type="button"
            onClick={() => setVer((v) => !v)}
            className="cursor-pointer text-xs font-medium text-primary-ink transition-colors hover:text-foreground"
          >
            {ver ? "ocultar" : "mostrar"}
          </button>
        </div>
        <div className="relative">
          <Lock
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            id="password"
            name="password"
            type={ver ? "text" : "password"}
            autoComplete="new-password"
            required
            autoFocus
            minLength={MINIMO}
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            className="h-11 w-full rounded-xl border border-input bg-card pl-10 pr-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-ring"
          />
        </div>
        {/* Un requisito en VIVO, no un checklist: hay una sola regla, y una
            lista de un ítem es ruido. `aria-live` para que el lector de
            pantalla lo cante sin robar el foco. El botón NUNCA se deshabilita
            —un botón gris no explica nada—; el que habla es este renglón. */}
        <p
          aria-live="polite"
          className={cn("flex items-center gap-1 text-xs", listo ? "text-success-ink" : "text-muted-foreground")}
        >
          {listo ? (
            <>
              <Check className="size-3.5" aria-hidden /> Ya está
            </>
          ) : valor.length === 0 ? (
            `Al menos ${MINIMO} caracteres.`
          ) : (
            `Te ${faltan === 1 ? "falta" : "faltan"} ${faltan} ${faltan === 1 ? "caracter" : "caracteres"}.`
          )}
        </p>
      </div>

      {pideRepetir && (
        <div className="space-y-1.5">
          <label htmlFor="repetir" className="text-sm font-medium">
            Repetila
          </label>
          <div className="relative">
            <Lock
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              id="repetir"
              name="repetir"
              type={ver ? "text" : "password"}
              autoComplete="new-password"
              required
              className="h-11 w-full rounded-xl border border-input bg-card pl-10 pr-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pending ? <LoaderCircle className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
        Guardar y entrar
      </button>

      {/* Alivio, no instrucción: por eso va debajo del botón y no arriba. */}
      <p className="text-center text-xs text-muted-foreground">
        No te la vamos a pedir de nuevo.
      </p>
    </form>
  );
}
