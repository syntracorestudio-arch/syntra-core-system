"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  MessageCircle,
  Package,
  Users,
  Receipt,
  CalendarDays,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { StoreRow } from "../super-client";
import { IdentidadSyntra } from "../super-sidebar";
import { Contactos, Notas, PuestaEnMarcha, CANAL_LABEL, haceCuanto } from "./contactos-notas";

export type Pago = {
  periodo: string;
  monto: number;
  medio: string | null;
  nota: string | null;
  cuando: string;
};

export type Contacto = {
  id: string;
  canal: string;
  resumen: string;
  actorEmail: string;
  cuando: string;
};

export type EntradaBitacora = {
  accion: string;
  actor_email: string;
  motivo: string;
  ip: string | null;
  cuando: string;
};

const pesos = (n: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function mesLargo(iso: string): string {
  const [a, m] = iso.split("-").map(Number);
  return `${MESES[m - 1]} ${a}`;
}

function fechaCorta(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

/**
 * Vocabulario OPERATIVO, distinto del que ve el cliente.
 *
 * `ETIQUETA_ACCION` (lib/auditoria) está escrita para el dueño y en su idioma:
 * "Te reemitimos la contraseña a pedido tuyo". Acá el lector es SYNTRA, mirando
 * la ficha durante una llamada: lo que sirve es el nombre del acto, corto y sin
 * segunda persona. Además `lib/auditoria` importa `next/headers`, así que no se
 * puede traer a un componente de cliente ni aunque quisiéramos.
 */
const ACCION_INTERNA: Record<string, string> = {
  negocio_creado: "Alta del negocio",
  negocio_suspendido: "Suspensión",
  negocio_reactivado: "Reactivación",
  asistente_activado: "Asistente IA activado",
  asistente_desactivado: "Asistente IA desactivado",
  credenciales_reemitidas: "Contraseña reemitida",
};

/**
 * Arma el mensaje de cobro listo para pegar en WhatsApp.
 *
 * ES EL CUELLO DE BOTELLA REAL del cobro manual. Saber quién debe ya lo
 * resuelve la cartera; lo que consume la tarde es redactar ocho mensajes
 * distintos, con el monto y los meses de cada uno, sin equivocarse de cliente.
 *
 * El tono es el del sistema: profesional y cercano, voseo, sin latiguillos.
 * NO amenaza con el corte — el mensaje que abre una conversación de cobro no es
 * el lugar; para eso está la escalera automática, que además lo dice con fecha.
 */
function mensajeDeCobro(store: StoreRow, alias: string | null): string {
  const sub = store.suscripcion;
  if (sub.estado !== "debe") return "";

  const quien = store.dueno?.split(" ")[0] ?? "";
  const saludo = quien ? `Hola ${quien}, ¿cómo va?` : "Hola, ¿cómo va?";

  /* Le falta menos de un mes: es una diferencia, no una mora. Puede ser una
     comisión bancaria o un monto mal cargado de nuestro lado, y tratarlo de
     moroso por eso es la forma más barata de perder un cliente que paga. */
  const esDiferencia = sub.parcial && sub.meses_impagos === 1;

  const cuerpo = esDiferencia
    ? `Quedaron ${pesos(sub.deuda)} pendientes de la suscripción de ${store.name}. Puede ser una diferencia del banco — si ya los mandaste, avisame y lo cargo.`
    : `Te escribo por la suscripción de StockFlow de ${store.name}: me figuran ${pesos(sub.deuda)} sin registrar (${sub.meses_impagos} ${sub.meses_impagos === 1 ? "mes" : "meses"}, desde ${mesLargo(sub.desde)}). Si ya pagaste, pasame el comprobante y lo asiento.`;

  const lineas = [saludo, "", cuerpo];
  if (alias) lineas.push("", `Alias para transferir: ${alias}`);
  return lineas.join("\n");
}

export function FichaCliente({
  store,
  pagos,
  bitacora,
  notas,
  contactos,
  seguimiento,
  tienePlan,
  alias,
  email,
  diasDesdeAlta,
  vendioEstaSemana,
}: {
  store: StoreRow;
  pagos: Pago[];
  bitacora: EntradaBitacora[];
  notas: string | null;
  contactos: Contacto[];
  seguimiento: string | null;
  tienePlan: boolean;
  alias: string | null;
  email: string | null;
  diasDesdeAlta: number;
  vendioEstaSemana: boolean;
}) {
  const [copiado, setCopiado] = useState(false);
  const ultimo = contactos[0] ?? null;
  const sub = store.suscripcion;
  const mensaje = mensajeDeCobro(store, alias);

  return (
    <div className="min-h-dvh">
      {/* La MISMA identidad que el rail, no una parecida: al entrar a la ficha
          de un cliente tiene que seguir siendo evidente que estás en el panel de
          SYNTRA y no adentro del sistema de ese negocio. */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-4xl">
          <IdentidadSyntra email={email} />
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-6 lg:px-8 lg:py-8">
      <Link
        href="/super"
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden /> Volver
      </Link>

      <header className="mb-6">
        <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight">
          {store.name}
          {store.status !== "active" && (
            <span className="rounded-full bg-danger/15 px-2 py-0.5 text-xs font-semibold text-danger-ink ring-1 ring-danger/30">
              Suspendido
            </span>
          )}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {store.dueno ?? "Sin dueño cargado"} · /{store.slug} · desde {fechaCorta(store.createdAt)}
        </p>
      </header>

      {/* La puesta en marcha va ANTES que la deuda cuando existe: si el cliente
          nunca arrancó, eso EXPLICA la deuda, y reclamarle plata a alguien que
          no pudo usar el producto es la peor conversación posible. */}
      <div className="mb-6 empty:hidden">
        <PuestaEnMarcha
          productos={store.productos}
          ventas={store.ventas}
          diasDesdeAlta={diasDesdeAlta}
          vendioEstaSemana={vendioEstaSemana}
        />
      </div>

      {/* LA DEUDA Y EL MENSAJE, ARRIBA DE TODO. Es lo que se mira mientras suena
          el teléfono; el resto de la ficha es respaldo para esa conversación. */}
      {sub.estado === "debe" && (
        <section className="mb-6 rounded-xl border border-danger/30 bg-danger/[0.06] p-4">
          <p className="tabular text-sm">
            <span className="text-lg font-semibold text-danger-ink">{pesos(sub.deuda)}</span>{" "}
            <span className="text-muted-foreground">
              sin registrar · {sub.meses_impagos} {sub.meses_impagos === 1 ? "mes" : "meses"} desde{" "}
              {mesLargo(sub.desde)} · {sub.dias_de_atraso} días de atraso
            </span>
          </p>

          {/* 066 · LO QUE CAMBIA LA CONVERSACIÓN. Los mismos 71 días de atraso
              se hablan distinto si ya reclamaste tres veces o si es la primera.
              Va acá y no abajo con el resto: se lee ANTES de levantar el
              teléfono, no después. */}
          <p className="mt-1 text-sm">
            {ultimo ? (
              <span className="text-muted-foreground">
                Último contacto {haceCuanto(ultimo.cuando)} ({CANAL_LABEL[ultimo.canal] ?? ultimo.canal})
                {contactos.length > 1 && ` · ${contactos.length} en total`}
              </span>
            ) : (
              /* Que NUNCA se lo haya contactado es un dato tan accionable como
                 la deuda, y es el caso más fácil de resolver: quizás sólo no se
                 enteró. */
              <span className="text-warning-ink">Nunca lo contactaste por esto.</span>
            )}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(mensaje);
                setCopiado(true);
              }}
              className="flex h-10 cursor-pointer items-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              {copiado ? <Check className="size-4" /> : <MessageCircle className="size-4" />}
              {copiado ? "Copiado" : "Copiar el mensaje de cobro"}
            </button>
            {!alias && (
              /* Se avisa en vez de mandar un mensaje sin el dato más importante:
                 sin alias, el cliente no sabe adónde transferir. */
              <span className="text-xs text-muted-foreground">
                Sin alias configurado — el mensaje sale sin esa línea (STOCKFLOW_ALIAS_COBRO).
              </span>
            )}
          </div>

          {/* El texto se MUESTRA, no sólo se copia: quien lo manda tiene que
              poder leerlo antes, y a veces cambiarle una palabra. */}
          <pre className="mt-3 whitespace-pre-wrap rounded-lg border border-border bg-card p-3 text-sm text-foreground">
            {mensaje}
          </pre>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-2 text-sm font-semibold">Uso</h2>
          <dl className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-card p-4 text-sm">
            <Dato icon={Package} label="Productos" valor={store.productos.toLocaleString("es-AR")} />
            <Dato icon={Users} label="Equipo" valor={String(store.miembros)} />
            <Dato
              icon={Receipt}
              label="Ventas (30 días)"
              valor={store.ventas30d.toLocaleString("es-AR")}
              alerta={store.ventas30d === 0}
            />
            <Dato
              icon={CalendarDays}
              label="Última venta"
              valor={store.ultimaVenta ? fechaCorta(store.ultimaVenta) : "Nunca"}
              alerta={!store.ultimaVenta}
            />
          </dl>
          {store.ventas30d === 0 && (
            /* La señal de retención más temprana que hay: se va antes de deberte
               plata. Va dicha, no escondida en un número gris. */
            <p className="mt-2 text-xs text-warning-ink">
              No vendió nada en 30 días. Conviene llamarlo aunque esté al día.
            </p>
          )}

          <h2 className="mb-2 mt-6 text-sm font-semibold">Notas</h2>
          <Notas storeId={store.id} valor={notas} habilitado={tienePlan} />
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold">Pagos</h2>
          {pagos.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
              Todavía no hay ningún pago asentado.
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border bg-card">
              {pagos.map((p, i) => (
                <li key={`${p.periodo}-${i}`} className="flex items-baseline gap-3 px-4 py-2.5 text-sm">
                  <span className="w-28 shrink-0 capitalize text-muted-foreground">
                    {mesLargo(p.periodo)}
                  </span>
                  <span className="tabular font-medium">{pesos(p.monto)}</span>
                  <span className="ml-auto truncate text-xs text-muted-foreground" title={p.nota ?? ""}>
                    {p.nota ?? p.medio ?? ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold">Contactos</h2>
        <Contactos
          storeId={store.id}
          contactos={contactos}
          seguimiento={seguimiento}
          tienePlan={tienePlan}
        />
      </section>

      <section className="mt-6">
        {/* Dos listas separadas a propósito: arriba lo que HABLAMOS con el
            cliente (interno, sólo lo vemos nosotros) y acá lo que le HICIMOS al
            negocio — que él lee en su propia pantalla. Mezclarlas sería el
            camino más corto a escribir una nota de cobranza en un lugar que el
            cliente puede leer. */}
        <h2 className="mb-2 text-sm font-semibold">Lo que hicimos sobre este negocio</h2>
        {bitacora.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            Nada registrado todavía.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {bitacora.map((b, i) => (
              <li key={i} className="px-4 py-3 text-sm">
                <p className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-medium">{ACCION_INTERNA[b.accion] ?? b.accion}</span>
                  <span className="text-xs text-muted-foreground">
                    {fechaCorta(b.cuando)} · {b.actor_email}
                  </span>
                </p>
                <p className="mt-0.5 text-muted-foreground">{b.motivo}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
      </div>
    </div>
  );
}

function Dato({
  icon: Icon,
  label,
  valor,
  alerta,
}: {
  icon: typeof Package;
  label: string;
  valor: string;
  alerta?: boolean;
}) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" aria-hidden /> {label}
      </dt>
      <dd className={cn("tabular mt-0.5 font-medium", alerta && "text-warning-ink")}>{valor}</dd>
    </div>
  );
}
