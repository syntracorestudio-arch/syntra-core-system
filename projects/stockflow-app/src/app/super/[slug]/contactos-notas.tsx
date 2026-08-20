"use client";

import { useState, useTransition } from "react";
import { Phone, Trash2, BellRing, Check } from "lucide-react";
import { registrarContacto, borrarContacto, guardarNotas } from "../actions";
import type { Contacto } from "./ficha-client";

/** Los canales, en el orden en que se usan de verdad para cobrar. */
export const CANAL_LABEL: Record<string, string> = {
  whatsapp: "WhatsApp",
  llamada: "Llamada",
  email: "Email",
  presencial: "En persona",
  otro: "Otro",
};

/**
 * "hace 3 días" en vez de una fecha.
 *
 * Para decidir si volver a llamar lo que importa es la DISTANCIA, no el día:
 * "hace 3 días" se procesa solo, "17/08/26" hay que restarlo mentalmente. La
 * fecha exacta queda en el `title`, que es donde se la busca cuando hace falta.
 */
export function haceCuanto(iso: string): string {
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (dias <= 0) return "hoy";
  if (dias === 1) return "ayer";
  if (dias < 30) return `hace ${dias} días`;
  const meses = Math.floor(dias / 30);
  return meses === 1 ? "hace un mes" : `hace ${meses} meses`;
}

/**
 * El registro del contacto humano.
 *
 * La escalera automática (060/061) deja constancia de lo que manda el SISTEMA.
 * Esto es lo otro: lo que hizo la persona. Sin este registro, "71 días de
 * atraso" no distingue al que ya ignoró tres reclamos del que quizás nunca se
 * enteró — y son dos decisiones distintas.
 */
export function Contactos({
  storeId,
  contactos,
  seguimiento,
  tienePlan,
}: {
  storeId: string;
  contactos: Contacto[];
  seguimiento: string | null;
  tienePlan: boolean;
}) {
  const [canal, setCanal] = useState("whatsapp");
  const [resumen, setResumen] = useState("");
  const [fecha, setFecha] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const hoy = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-3">
      {seguimiento && (
        /* La fecha agendada va ARRIBA del formulario: si hay un compromiso de
           volver a llamar, es lo primero que hay que ver al abrir la ficha. */
        <p className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-sm">
          <BellRing className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span>
            Volver a contactarlo el{" "}
            <span className="font-medium">
              {new Date(seguimiento + "T00:00:00").toLocaleDateString("es-AR", {
                day: "numeric",
                month: "long",
              })}
            </span>
          </span>
        </p>
      )}

      <form
        className="rounded-xl border border-border bg-card p-3"
        action={() => {
          setError(null);
          startTransition(async () => {
            const r = await registrarContacto(
              storeId,
              canal,
              resumen,
              fecha || null,
              /* Sólo se toca el seguimiento si se escribió una fecha: si no,
                 registrar un contacto borraría la fecha ya agendada, que es
                 justo lo contrario de lo que espera el que anota. */
              Boolean(fecha),
            );
            if (!r.ok) {
              setError(r.error ?? "No pudimos registrarlo.");
              return;
            }
            setResumen("");
            setFecha("");
          });
        }}
      >
        <div className="flex flex-wrap gap-2">
          <select
            value={canal}
            onChange={(e) => setCanal(e.target.value)}
            aria-label="Por dónde lo contactaste"
            className="h-9 cursor-pointer rounded-lg border border-input bg-background px-2 text-sm outline-none focus:border-primary"
          >
            {Object.entries(CANAL_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <input
            value={resumen}
            onChange={(e) => setResumen(e.target.value)}
            placeholder="Dijo que paga el viernes."
            aria-label="Qué pasó"
            className="h-9 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
          />
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            Volver a contactarlo el
            <input
              type="date"
              value={fecha}
              min={hoy}
              onChange={(e) => setFecha(e.target.value)}
              className="h-9 cursor-pointer rounded-lg border border-input bg-background px-2 text-sm outline-none focus:border-primary"
            />
          </label>
          <button
            type="submit"
            disabled={pending || resumen.trim().length < 3}
            className="ml-auto flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Phone className="size-3.5" aria-hidden />
            {pending ? "Guardando…" : "Anotar"}
          </button>
        </div>

        {error && (
          <p className="mt-2 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger-ink">{error}</p>
        )}
        {!tienePlan && (
          <p className="mt-2 text-xs text-muted-foreground">
            La fecha de seguimiento necesita que el negocio tenga un plan asignado.
          </p>
        )}
      </form>

      {contactos.length > 0 && (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {contactos.map((c) => (
            <li key={c.id} className="flex items-start gap-3 px-4 py-2.5 text-sm">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-medium">{CANAL_LABEL[c.canal] ?? c.canal}</span>
                  <span
                    className="text-xs text-muted-foreground"
                    title={new Date(c.cuando).toLocaleString("es-AR")}
                  >
                    {haceCuanto(c.cuando)}
                  </span>
                </p>
                <p className="mt-0.5 whitespace-pre-wrap text-muted-foreground">{c.resumen}</p>
              </div>
              {/* Borrar sí, editar no (066): cargarlo en el negocio equivocado
                  tiene que poder deshacerse, pero reescribir "ya le reclamé" en
                  silencio, no. */}
              <button
                type="button"
                aria-label="Borrar este contacto"
                onClick={() =>
                  startTransition(async () => {
                    await borrarContacto(c.id);
                  })
                }
                className="shrink-0 cursor-pointer rounded-md p-1.5 text-muted-foreground transition-colors hover:text-danger-ink"
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * La ficha permanente del cliente.
 *
 * Distinta de un contacto: el contacto es "qué pasó el martes", la nota es "lo
 * que hay que saber de este cliente siempre" — que atiende después de las seis,
 * que el hijo maneja la caja. Por eso se pisa en vez de acumularse.
 */
export function Notas({
  storeId,
  valor,
  habilitado,
}: {
  storeId: string;
  valor: string | null;
  habilitado: boolean;
}) {
  const [texto, setTexto] = useState(valor ?? "");
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const cambio = texto !== (valor ?? "");

  return (
    <div>
      <textarea
        rows={3}
        value={texto}
        disabled={!habilitado}
        onChange={(e) => {
          setTexto(e.target.value);
          setGuardado(false);
        }}
        placeholder={
          habilitado
            ? "Atiende después de las 6. El hijo maneja la caja."
            : "Asignale un plan al negocio para poder dejarle notas."
        }
        className="w-full rounded-xl border border-border bg-card p-4 text-sm outline-none placeholder:text-muted-foreground focus:border-primary disabled:cursor-not-allowed disabled:opacity-60"
      />
      <div className="mt-1.5 flex items-center gap-2">
        {/* El botón aparece SÓLO si hay algo distinto que guardar: un "Guardar"
            permanente al pie de un campo invita a apretarlo sin cambios y a
            dudar de si se guardó. */}
        {cambio && (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const r = await guardarNotas(storeId, texto);
                if (!r.ok) {
                  setError(r.error ?? "No pudimos guardarla.");
                  return;
                }
                setGuardado(true);
              });
            }}
            className="h-9 cursor-pointer rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Guardando…" : "Guardar la nota"}
          </button>
        )}
        {guardado && !cambio && (
          <span className="flex items-center gap-1 text-xs text-success-ink">
            <Check className="size-3.5" /> Guardada
          </span>
        )}
        {error && <span className="text-xs text-danger-ink">{error}</span>}
      </div>
    </div>
  );
}
