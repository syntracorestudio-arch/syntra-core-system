"use client";

import { useState } from "react";
import {
  crearSuscripcion,
  cambiarPrecioSuscripcion,
  cancelarSuscripcion,
} from "./actions";
import type { Suscripcion } from "./super-client";

const pesos = (n: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);

/**
 * El plan de un negocio: alta, precio y baja.
 *
 * NO PIDE FECHAS, y ése es el punto. Hasta 062 las suscripciones se cargaban a
 * mano en la base, y la verificación adversarial midió dos tipeos plausibles
 * que terminaban en cortes indebidos: `cobra_desde` con la fecha del alta
 * (corte a los 5 días, con 15 de "atraso") y `prueba_hasta` solapado con
 * `cobra_desde` (deber el mes que le habíamos regalado).
 *
 * Un campo que no existe no se puede tipear mal: acá se elige precio y si lleva
 * mes de prueba, y la base calcula el resto.
 */
export function DialogoPlan({
  storeId,
  nombre,
  sub,
  pending,
  onCerrar,
  onResultado,
  startTransition,
}: {
  storeId: string;
  nombre: string;
  sub: Suscripcion;
  pending: boolean;
  onCerrar: () => void;
  onResultado: (r: { tone: "ok" | "error"; text: string }) => void;
  startTransition: (fn: () => void) => void;
}) {
  const existe = sub.estado !== "sin_suscripcion";
  const precioActual = "precio" in sub ? sub.precio : 60000;

  const [precio, setPrecio] = useState(String(precioActual));
  const [conPrueba, setConPrueba] = useState(true);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);

  const n = Number(precio.replace(/[^\d]/g, ""));
  const cambioElPrecio = existe && n !== precioActual;
  /* El motivo se exige sólo cuando cambia plata: pedirlo para todo entrena a
     escribir "asdf" y lo vuelve inútil justo donde hace falta. */
  const necesitaMotivo = cambioElPrecio;

  function bajaOReactivacion() {
    const esReactivar = sub.estado === "cancelada";
    const m = window.prompt(
      esReactivar
        ? "¿Por qué se reactiva? (mínimo 10 caracteres)"
        : "¿Por qué se da de baja? (mínimo 10 caracteres)",
    );
    if (!m) return;
    startTransition(async () => {
      const r = await cancelarSuscripcion(storeId, m, esReactivar);
      onResultado(
        r.ok
          ? {
              tone: "ok",
              text: esReactivar
                ? `El plan de ${nombre} está activo de nuevo.`
                : `El plan de ${nombre} quedó dado de baja.`,
            }
          : { tone: "error", text: r.error ?? "No pudimos actualizar el plan." },
      );
    });
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      {/* Cuerpo con scroll y acciones fijas al pie: tiene textarea, así que el
          teclado se abre sí o sí (responsive-audit §3). */}
      <div className="flex max-h-[85dvh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-popover">
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <h2 className="text-lg font-semibold">
            {existe ? `Plan de ${nombre}` : `Asignarle un plan a ${nombre}`}
          </h2>

          <label htmlFor="precio-plan" className="mt-4 block text-sm font-medium">
            Precio por mes
          </label>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-sm text-muted-foreground">$</span>
            <input
              id="precio-plan"
              inputMode="numeric"
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
              className="tabular h-11 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none focus:border-primary"
            />
          </div>

          {!existe && (
            <label className="mt-4 flex cursor-pointer items-start gap-2.5">
              <input
                type="checkbox"
                checked={conPrueba}
                onChange={(e) => setConPrueba(e.target.checked)}
                className="mt-0.5 size-4 cursor-pointer"
              />
              <span className="text-sm">
                Primer mes gratis
                {/* Se dice QUÉ va a pasar, no cómo se calcula. */}
                <span className="block text-xs text-muted-foreground">
                  Empieza a pagar el mes siguiente al que termina la prueba.
                </span>
              </span>
            </label>
          )}

          {cambioElPrecio && (
            <>
              <p className="mt-4 rounded-lg border border-border bg-secondary px-3 py-2 text-xs text-muted-foreground">
                Rige desde el mes que viene. Lo que ya debe queda al precio viejo.
              </p>
              <label htmlFor="motivo-plan" className="mt-3 block text-sm font-medium">
                ¿Por qué cambia?
              </label>
              <textarea
                id="motivo-plan"
                rows={2}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Aumento por inflación acumulada del semestre."
                className="mt-1 w-full rounded-lg border border-input bg-card p-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
              />
            </>
          )}

          {error && (
            <p className="mt-3 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger-ink">
              {error}
            </p>
          )}

          {existe && (
            <button
              type="button"
              disabled={pending}
              onClick={bajaOReactivacion}
              className="mt-5 cursor-pointer text-xs text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground"
            >
              {sub.estado === "cancelada" ? "Reactivar el plan" : "Dar de baja el plan"}
            </button>
          )}
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-border bg-popover px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onCerrar}
            className="h-10 cursor-pointer rounded-lg border border-border px-4 text-sm"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={pending || n <= 0 || (necesitaMotivo && motivo.trim().length < 10)}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const r = existe
                  ? await cambiarPrecioSuscripcion(storeId, n, motivo.trim())
                  : await crearSuscripcion(storeId, n, conPrueba);
                if (!r.ok) {
                  setError(r.error ?? "No pudimos guardar el plan.");
                  return;
                }
                onResultado({
                  tone: "ok",
                  text: existe
                    ? `El plan de ${nombre} pasa a ${pesos(n)} desde el mes que viene.`
                    : `${nombre} quedó con plan de ${pesos(n)} por mes.`,
                });
              });
            }}
            className="h-10 cursor-pointer rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Guardando…" : existe ? "Guardar" : "Crear el plan"}
          </button>
        </div>
      </div>
    </div>
  );
}
