"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  Store,
  Plus,
  X,
  LoaderCircle,
  Check,
  TriangleAlert,
  Copy,
  Pause,
  Play,
  Sparkles,
  SlidersHorizontal,
  KeyRound,
  BellRing,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { SuperSidebar, FILTROS, type Vista, type Filtro } from "./super-sidebar";
import { CobranzaGrilla, type CeldaCobranza } from "./cobranza-grilla";
import { Resumen, type MesIngreso, type CobradoCliente } from "./resumen-client";
import {
  crearNegocio,
  cambiarEstado,
  setAsistenteIA,
  marcarPagoSuscripcion,
  reemitirCredenciales,
  type AltaResult,
} from "./actions";
import { DialogoPlan } from "./plan-dialog";
import { haceCuanto } from "@/app/admin/fiado/fiado-client";

export type Vertical = "kiosco" | "dietetica" | "petshop" | "otro";

/** Rubros del negocio. El label es cara-al-cliente; el value viaja a la DB. */
export const VERTICALES: { value: Vertical; label: string }[] = [
  { value: "kiosco", label: "Kiosco" },
  { value: "dietetica", label: "Dietética" },
  { value: "petshop", label: "Pet shop" },
  { value: "otro", label: "Otro" },
];

/**
 * El estado de cobranza, tal cual lo devuelve `estado_suscripcion` (057).
 *
 * Se tipa la UNIÓN y no un objeto con todo opcional: así el compilador obliga a
 * contemplar cada caso donde se lo consume. Un `estado: string` dejaría pasar
 * "debe" sin mostrar la deuda.
 */
export type Suscripcion =
  | { estado: "sin_suscripcion" }
  | { estado: "cancelada"; cancelada_el: string }
  | { estado: "prueba"; prueba_hasta: string; precio: number }
  | { estado: "al_dia"; precio: number; proximo_vencimiento: string }
  | {
      estado: "debe";
      precio: number;
      meses_impagos: number;
      desde: string;
      deuda: number;
      /* 058 · pagó algo pero no todo. "Te falta completar" no es "no pagaste",
         y quien levanta el teléfono necesita esa diferencia. */
      parcial: boolean;
      dias_de_atraso: number;
    };

export type StoreRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  dueno: string | null;
  miembros: number;
  productos: number;
  ventas: number;
  ventas30d: number;
  ultimaVenta: string | null;
  createdAt: string;
  vertical: string;
  aiAssistant: boolean;
  suscripcion: Suscripcion;
  /* 067 · el seguimiento, para que una fecha agendada se vea en la LISTA y no
     sólo adentro de la ficha del cliente. Si hay que entrar de a uno para
     saber a quién llamar, la agenda no sirve para planificar la semana. */
  seguimientoEl: string | null;
  ultimoContacto: string | null;
  contactos: number;
};

/**
 * LAS COLUMNAS DE LA CARTERA, en un solo lugar.
 *
 * El encabezado y las filas TIENEN que compartir la misma definición: si viven
 * en dos strings distintos, el día que alguien ensancha una columna el título
 * queda corrido respecto de su dato y nadie lo nota hasta que el panel miente.
 *
 * Anchos fijos y no `auto`: `auto` mide el contenido de cada celda, o sea que
 * las columnas se moverían al filtrar. Que se muevan al filtrar es exactamente
 * lo que rompe la comparación entre filas.
 */
/* `justify-items-start` evita que un badge se estire a los 11rem de su columna
   y parezca un botón deformado: en una grilla los hijos se estiran por defecto.

   La última columna es FIJA (9.5rem) y no `auto`, y eso no es cosmético: con
   `auto`, la pista se mide por su contenido, así que valía 0px en el encabezado
   —donde la celda de acciones es `sr-only`— y ~125px en las filas. Como la
   primera columna es `1fr`, esa diferencia se la comía ella y los títulos
   quedaban corridos ~126px respecto de sus datos. Peor todavía: entre filas
   también variaba, porque el engranaje del plan sólo aparece si hay plan. 9.5rem
   entra justo los cuatro botones (4×32 + 3×6 = 146px). */
const GRILLA =
  "grid grid-cols-[minmax(0,1fr)_15rem_11rem_10rem_9.5rem] items-center justify-items-start gap-3";

/* Escrito LITERAL y no derivado de `GRILLA` con un `.map(c => "lg:" + c)`:
   Tailwind genera CSS escaneando clases literales en el código fuente, así que
   una clase construida en runtime no existe en la hoja de estilos. El
   duplicado es feo pero es la única versión que funciona. */
const GRILLA_LG =
  "lg:grid lg:grid-cols-[minmax(0,1fr)_15rem_11rem_10rem_9.5rem] lg:items-center lg:justify-items-start lg:gap-3";

export function SuperClient({
  stores,
  email,
  celdas,
  meses,
  porCliente,
}: {
  stores: StoreRow[];
  email: string | null;
  celdas: CeldaCobranza[];
  meses: MesIngreso[];
  porCliente: CobradoCliente[];
}) {
  const [creando, setCreando] = useState(false);
  /* El mismo diálogo sirve para el alta y para la reemisión, pero el texto NO
     puede ser el mismo: en el alta la clave estrena una cuenta y en la
     reemisión reemplaza una que dejó de andar. `modo` es lo que decide qué se
     le dice al que la está por dictar por teléfono. */
  const [alta, setAlta] = useState<
    (Extract<AltaResult, { ok: true }> & { modo: "alta" | "reemision" }) | null
  >(null);
  const [aviso, setAviso] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  /* 055 · ninguna mutación de este panel se ejecuta sin motivo: el botón abre
     este diálogo y la acción sale desde ahí. */
  const [pidiendoMotivo, setPidiendoMotivo] = useState<PedidoDeMotivo | null>(null);
  /* 057 · marcar un pago es un acto CONTABLE: abre diálogo, no se dispara de un
     click. Un pago marcado por error deja al cliente "al día" sin haber pagado
     y no hay forma de notarlo después. */
  /* 062 · el alta y la edición del plan. Antes esto se hacía con SQL a mano y
     dos tipeos plausibles terminaban en cortes indebidos. */
  const [editandoPlan, setEditandoPlan] = useState<{
    storeId: string;
    nombre: string;
    sub: Suscripcion;
  } | null>(null);
  const [cobrando, setCobrando] = useState<
    { storeId: string; nombre: string; sub: Suscripcion } | null
  >(null);

  const [vista, setVista] = useState<Vista>("cartera");
  const [filtro, setFiltro] = useState<Filtro>("todos");

  const activos = stores.filter((s) => s.status === "active").length;

  /* "Sin vender" = CERO ventas en 30 días, y el dato sale de `ventas_30d`, que
     ya viene contado en SQL con su ventana.
     La primera versión hacía la resta en el cliente contra `Date.now()` para
     usar un umbral de 14 días. Dos problemas: `react-hooks/purity` lo prohíbe
     con razón (durante el render es impuro), y el reloj del navegador no tiene
     por qué coincidir con el del server — el mismo negocio podía entrar o no en
     el filtro según quién lo mirara. 30 días avisa más tarde que 14, pero lo
     dice sin inventar aritmética de fechas del lado del cliente. */
  const sinVender = (s: StoreRow) => s.ventas30d === 0;

  const cumple = (s: StoreRow, f: Filtro): boolean => {
    switch (f) {
      case "todos": return true;
      case "deben": return s.suscripcion.estado === "debe";
      case "prueba": return s.suscripcion.estado === "prueba";
      case "sin_plan": return s.suscripcion.estado === "sin_suscripcion";
      case "sin_vender": return sinVender(s);
      case "de_baja": return s.suscripcion.estado === "cancelada";
    }
  };

  /* Los conteos se calculan sobre TODOS los negocios y no sobre lo filtrado:
     un chip que muestra el tamaño del recorte actual no le sirve a nadie —lo
     que se quiere saber antes de tocarlo es cuántos hay del otro lado. */
  const conteos = Object.fromEntries(
    FILTROS.map((f) => [f.id, stores.filter((s) => cumple(s, f.id)).length]),
  ) as Record<Filtro, number>;

  const visibles = stores.filter((s) => cumple(s, filtro));

  /* 057 · las otras dos preguntas de la semana, arriba de todo.
     Se calculan acá y no en SQL porque son una suma sobre 10 filas que ya
     están en memoria: una RPC nueva para esto sería una consulta de más por
     cada visita, a cambio de nada. */
  /* "POR MES" y no "este mes", y la diferencia no es cosmética: el mes corriente
     de un cliente que debe está contado en las DOS cifras (acá y en la deuda).
     Con la etiqueta "este mes" al lado de "sin cobrar", leído rápido parece que
     entran las dos sumadas. "Por mes" dice lo que el número es: lo que factura
     el plan si todos pagan — o sea MRR, sin usar la sigla. */
  const porMes = stores.reduce(
    (t, s) => t + (s.suscripcion.estado === "al_dia" || s.suscripcion.estado === "debe"
      ? s.suscripcion.precio : 0),
    0,
  );
  const deudaTotal = stores.reduce(
    (t, s) => t + (s.suscripcion.estado === "debe" ? s.suscripcion.deuda : 0),
    0,
  );
  const enPrueba = stores.filter((s) => s.suscripcion.estado === "prueba").length;

  /* 063 · LA COLA DE CORTE. Con el corte automático apagado —que es el default
     y va a seguir siéndolo mientras los pagos se marquen a mano— esta lista ES
     el mecanismo de corte. Hasta ahora existía sólo en el JSON de la respuesta
     del cron, o sea en ningún lado que alguien mire.

     El criterio espeja el de `cobranza_escalon` (061): pasó el día 25 (15 días
     desde el vencimiento) Y debe al menos un mes completo. Se deriva de lo que
     la fila ya trae — una consulta nueva para esto sería trabajo de más. */
  const paraCortar = stores.filter(
    (s) =>
      s.suscripcion.estado === "debe" &&
      s.status === "active" &&
      s.suscripcion.dias_de_atraso >= 15 &&
      s.suscripcion.deuda >= s.suscripcion.precio,
  );

  return (
    /* `overflow-x-clip` como red de seguridad: la pagina de este panel no tiene
       por que scrollear nunca en horizontal. `clip` y no `hidden` a proposito —
       hidden crea un contenedor de scroll y romperia el `sticky` de la primera
       columna de la grilla. */
    <div className="min-h-dvh overflow-x-clip lg:flex">
      <SuperSidebar
        email={email}
        vista={vista}
        onVista={setVista}
        filtro={filtro}
        onFiltro={setFiltro}
        conteos={conteos}
      />

      {/* `min-w-0` no es decorativo: sin él, la tabla de cobranza —que puede
          medir más que la pantalla— ensancha el flex item y el desborde se lo
          come la PÁGINA en vez de su propio contenedor. */}
      {/* `min-w-0` no es decorativo: sin él, la tabla de cobranza —que puede
          medir más que la pantalla— ensancha el flex item y el desborde se lo
          come la PÁGINA en vez de su propio contenedor.

          Y el `max-w-6xl` tampoco: sin tope, a 1920 las filas se estiran a
          1680px y el nombre del negocio queda a un palmo de sus datos, con un
          vacío en el medio que no comunica nada. La sidebar se llevó el ancho
          que antes acotaba el `max-w-5xl` centrado. */}
      <div className="min-w-0 flex-1 px-4 py-6 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-6xl">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight lg:text-2xl">
              {vista === "cobranza" ? "Cobranza" : vista === "resumen" ? "Resumen" : "Negocios"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {vista === "resumen"
                ? "Cuánto entra, de dónde viene y cuánto falta."
                : vista === "cobranza"
                ? "Quién pagó cada mes, y quién viene arrastrando."
                : stores.length === 0
                  ? "Todavía no hay ninguno."
                  : filtro === "todos"
                    ? `${activos} activo${activos === 1 ? "" : "s"} de ${stores.length}`
                    : `${visibles.length} de ${stores.length}`}
            </p>

          </div>
          <button
            type="button"
            onClick={() => setCreando(true)}
            className="flex h-10 cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Plus className="size-4" /> Dar de alta un kiosco
          </button>
        </div>

        {/* LAS TRES CIFRAS DE LA SEMANA, con jerarquía de verdad.
            Antes vivían en una línea corrida de 14px debajo del subtítulo: la
            información más importante de la pantalla con el peso visual de un
            pie de página. El sistema de cards del panel del dueño existe
            justamente para esto.

            NO llevan glow verde: en esta app el verde está reservado para plata
            REAL —cobrada— y "por mes" es lo que entra SI TODOS PAGAN. Teñir de
            verde una promesa es la clase de detalle que hace que después nadie
            crea en el color.

            Y nada de contadores animados: animar "sin cobrar" es celebrar la
            mora. */}
        {vista === "cartera" && stores.length > 0 && (
          <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Cifra
              label="Por mes"
              valor={pesos(porMes)}
              nota={enPrueba > 0 ? `${enPrueba} en prueba, sin cobrar todavía` : "Si todos pagan"}
            />
            {/* La deuda sólo aparece si existe: un "$0 sin cobrar" permanente
                enseña a ignorar ese renglón, y el día que diga algo tampoco se
                lo va a mirar. */}
            {deudaTotal > 0 && (
              <Cifra
                label="Sin cobrar"
                valor={pesos(deudaTotal)}
                tono="danger"
                nota={`${stores.filter((x) => x.suscripcion.estado === "debe").length} ${
                  stores.filter((x) => x.suscripcion.estado === "debe").length === 1
                    ? "negocio"
                    : "negocios"
                }`}
              />
            )}
            {paraCortar.length > 0 && (
              <Cifra
                label="Para cortar"
                valor={String(paraCortar.length)}
                tono="danger"
                nota="Pasaron 15 días del vencimiento"
              />
            )}
          </div>
        )}

        {aviso && (
          <div
            role="status"
            className={cn(
              "mb-4 flex items-start gap-2 rounded-lg px-3 py-2 text-sm ring-1",
              aviso.tone === "ok"
                ? "bg-success/10 text-success-ink ring-success/25"
                : "bg-danger/10 text-danger-ink ring-danger/25",
            )}
          >
            {aviso.tone === "ok" ? (
              <Check className="mt-0.5 size-4 shrink-0" />
            ) : (
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            )}
            <span className="flex-1">{aviso.text}</span>
            <button type="button" onClick={() => setAviso(null)} aria-label="Cerrar aviso" className="cursor-pointer opacity-60 hover:opacity-100">
              <X className="size-4" />
            </button>
          </div>
        )}

        {vista === "resumen" ? (
          <Resumen meses={meses} porCliente={porCliente} stores={stores} />
        ) : vista === "cobranza" ? (
          <CobranzaGrilla stores={stores} celdas={celdas} />
        ) : stores.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-6 py-14 text-center">
            <Store className="mx-auto mb-3 size-8 text-muted-foreground" />
            <p className="text-sm font-medium">Ningún negocio todavía</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Dale de alta al primero y pasale las credenciales.
            </p>
          </div>
        ) : visibles.length === 0 ? (
          /* Vacío POR EL FILTRO, que es otra cosa que "no hay negocios": el
             texto tiene que decir qué pasó y ofrecer la salida, no dejar al
             que filtró mirando una caja vacía sin saber por qué. */
          <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
            <p className="text-sm font-medium">Ninguno entra en este filtro</p>
            <button
              type="button"
              onClick={() => setFiltro("todos")}
              className="mt-2 cursor-pointer text-sm text-primary-ink underline underline-offset-2"
            >
              Ver todos
            </button>
          </div>
        ) : (
          <>
          {/* ENCABEZADO DE COLUMNAS. No es adorno: hasta ahora la fila era un
              flex-wrap y cada dato caía en una posición distinta según el largo
              del texto anterior — "5 prod." y "2007 prod." empujaban todo lo de
              atrás. Con tres clientes se tolera; con treinta es ilegible,
              porque comparar exige que los números estén en columna.
              Se oculta en mobile, donde la fila se apila y las etiquetas
              volverían a mezclar la información en vez de ordenarla. */}
          <div className={cn(GRILLA, "hidden px-4 pb-1.5 lg:grid")}>
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Negocio
            </span>
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Uso
            </span>
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Cobranza
            </span>
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Seguimiento
            </span>
            <span className="sr-only">Acciones</span>
          </div>
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {visibles.map((s) => (
              <li
                key={s.id}
                className={cn(
                  "px-4 py-3",
                  /* Mobile apila; desde lg entra la grilla de columnas fijas,
                     que es la que permite comparar entre filas. */
                  "flex flex-wrap items-center gap-3",
                  GRILLA_LG,
                  /* 063 · el que está listo para cortar se marca en la FILA, no
                     con un ícono más: la lista se recorre de arriba a abajo una
                     vez por semana y lo que importa es cuál salta a la vista.
                     Un borde izquierdo no le roba ancho a nada. */
                  paraCortar.some((p) => p.id === s.id) &&
                    "border-l-2 border-danger bg-danger/[0.03]",
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    {/* La fila NAVEGA a la ficha; no se expande. El historial de
                        pagos y la bitácora son lo que se lee mientras se habla
                        con el cliente, y eso no entra en un acordeón que empuja
                        el resto de la lista. */}
                    <Link
                      href={`/super/${s.slug}`}
                      className="rounded-sm underline-offset-2 transition-colors hover:text-primary-ink hover:underline"
                    >
                      {s.name}
                    </Link>
                    {s.status !== "active" && (
                      <span className="rounded-full bg-danger/15 px-1.5 py-0.5 text-[10px] font-semibold text-danger-ink ring-1 ring-danger/30">
                        suspendido
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {s.dueno ?? "sin dueño"} · /{s.slug}
                  </p>
                </div>
                {/* Sub-columnas de ancho fijo y no un `gap` entre textos: con
                    gap, "1 prod." y "2007 prod." empujan lo que sigue y los
                    tres datos caen en una x distinta en cada fila. Comparar
                    entre filas exige que la columna sea columna. */}
                <div className="tabular flex shrink-0 items-baseline gap-2 text-xs text-muted-foreground lg:w-full">
                  <span className="lg:w-20">{s.productos} prod.</span>
                  {/* 057 · ventas de los ÚLTIMOS 30 DÍAS y no el acumulado
                      histórico: "1347 ventas" no distingue a un cliente activo
                      de uno que vendió mucho hace un año, que es justo la
                      diferencia que hay que ver acá. */}
                  <span className="lg:w-20">{s.ventas30d} en 30d</span>
                  {/* La última venta es el pulso real: un kiosco que no vende
                      hace una semana dejó de usar el sistema. */}
                  <span
                    className={cn(
                      "lg:w-24",
                      s.ultimaVenta === null && "text-danger-ink",
                    )}
                  >
                    {s.ultimaVenta ? haceCuanto(s.ultimaVenta) : "nunca vendió"}
                  </span>
                </div>

                <EstadoCobranza
                  sub={s.suscripcion}
                  onMarcarPago={() =>
                    setCobrando({ storeId: s.id, nombre: s.name, sub: s.suscripcion })
                  }
                  onEditarPlan={() =>
                    setEditandoPlan({ storeId: s.id, nombre: s.name, sub: s.suscripcion })
                  }
                  pending={pending}
                />

                <Seguimiento
                  seguimientoEl={s.seguimientoEl}
                  ultimoContacto={s.ultimoContacto}
                  contactos={s.contactos}
                  debe={s.suscripcion.estado === "debe"}
                />
                {/* TODAS las acciones en UN solo hijo de la grilla.
                    Sueltas eran seis hermanos más en una grilla de cinco
                    columnas, así que desbordaban a renglones implícitos y los
                    botones se estiraban a lo ancho de la columna que les
                    tocaba. Una grilla no acomoda lo que le sobra: lo apila. */}
                <div className="flex shrink-0 items-center gap-1.5 lg:justify-self-end">
                {/* El engranaje aparece SÓLO si ya hay plan: para el que no
                    tiene, la puerta es el propio "sin plan". Cambiar el precio
                    o dar de baja se hace una vez por año — no compite por
                    espacio con marcar un pago, que es lo de todos los meses. */}
                {s.suscripcion.estado !== "sin_suscripcion" && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      setEditandoPlan({ storeId: s.id, nombre: s.name, sub: s.suscripcion })
                    }
                    aria-label={`Plan de ${s.name}`}
                    title="Plan"
                    className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-md border border-border text-muted-foreground transition-colors hover:border-primary hover:text-foreground disabled:opacity-40"
                  >
                    <SlidersHorizontal className="size-3.5" />
                  </button>
                )}
                {/* Add-on del Asistente IA: prender/apagar por negocio. Es el flag
                    que decide si el negocio entra al reporte mensual (cron PR2). */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={s.aiAssistant}
                  disabled={pending}
                  /* 055 · ya no ejecuta: abre el diálogo que pide el motivo. El
                     motivo no es burocracia — es lo que el DUEÑO va a leer en
                     su pantalla para entender qué le pasó a su negocio. */
                  onClick={() =>
                    setPidiendoMotivo({
                      storeId: s.id,
                      nombre: s.name,
                      tipo: "ia",
                      valor: !s.aiAssistant,
                    })
                  }
                  aria-label={
                    s.aiAssistant
                      ? `Apagar Asistente IA en ${s.name}`
                      : `Activar Asistente IA en ${s.name}`
                  }
                  title="Asistente IA"
                  className={cn(
                    "flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-md border px-2 text-xs font-medium transition-colors disabled:opacity-40",
                    s.aiAssistant
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground",
                  )}
                >
                  <Sparkles className="size-3.5" />
                  IA
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    setPidiendoMotivo({
                      storeId: s.id,
                      nombre: s.name,
                      tipo: "estado",
                      valor: s.status !== "active",
                    })
                  }
                  aria-label={s.status === "active" ? `Suspender ${s.name}` : `Reactivar ${s.name}`}
                  className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-md border border-border text-muted-foreground transition-colors hover:border-primary hover:text-foreground disabled:opacity-40"
                >
                  {s.status === "active" ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
                </button>
                {/* Reemitir la contraseña del dueño. Va acá, al lado de
                    suspender, porque las dos son cosas que se hacen cuando el
                    cliente LLAMA — no es una acción de configuración.
                    Es la única salida real hoy: "Me olvidé la contraseña" manda
                    un mail y todavía no hay SMTP. */}
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    setPidiendoMotivo({
                      storeId: s.id,
                      nombre: s.name,
                      tipo: "credenciales",
                      valor: true,
                    })
                  }
                  aria-label={`Reemitir la contraseña del dueño de ${s.name}`}
                  title="Reemitir la contraseña del dueño"
                  className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-md border border-border text-muted-foreground transition-colors hover:border-primary hover:text-foreground disabled:opacity-40"
                >
                  <KeyRound className="size-3.5" />
                </button>
                </div>
              </li>
            ))}
          </ul>
          </>
        )}
        </div>
      </div>

      {creando && (
        <AltaDialog
          onClose={() => setCreando(false)}
          onDone={(r) => {
            setCreando(false);
            setAlta({ ...r, modo: "alta" });
          }}
        />
      )}

      {alta && <CredencialesDialog alta={alta} onClose={() => setAlta(null)} />}

      {editandoPlan && (
        <DialogoPlan
          storeId={editandoPlan.storeId}
          nombre={editandoPlan.nombre}
          sub={editandoPlan.sub}
          pending={pending}
          onCerrar={() => setEditandoPlan(null)}
          onResultado={(r) => {
            setEditandoPlan(null);
            setAviso(r);
          }}
          startTransition={startTransition}
        />
      )}

      {cobrando && (
        <DialogoDePago
          nombre={cobrando.nombre}
          sub={cobrando.sub}
          pending={pending}
          onCancelar={() => setCobrando(null)}
          onConfirmar={(periodo, monto, nota) => {
            startTransition(async () => {
              const r = await marcarPagoSuscripcion(cobrando.storeId, periodo, monto, nota);
              setCobrando(null);
              setAviso(
                r.ok
                  ? { tone: "ok", text: `Pago de ${cobrando.nombre} registrado.` }
                  : { tone: "error", text: r.error ?? "No se pudo registrar." },
              );
            });
          }}
        />
      )}

      {pidiendoMotivo && (
        <DialogoDeMotivo
          pedido={pidiendoMotivo}
          pending={pending}
          onCancelar={() => setPidiendoMotivo(null)}
          onConfirmar={(motivo) => {
            const p = pidiendoMotivo;
            startTransition(async () => {
              /* La reemisión sale antes que las otras dos porque NO termina en
                 un aviso: termina abriendo el diálogo con la contraseña, que es
                 lo único que hay que hacer con ella. */
              if (p.tipo === "credenciales") {
                const r = await reemitirCredenciales(p.storeId, motivo);
                setPidiendoMotivo(null);
                if (!r.ok) {
                  setAviso({ tone: "error", text: r.error ?? "No se pudo completar." });
                  return;
                }
                setAlta({ ...r, modo: "reemision" });
                return;
              }

              const r =
                p.tipo === "estado"
                  ? await cambiarEstado(p.storeId, p.valor ? "active" : "suspended", motivo)
                  : await setAsistenteIA(p.storeId, p.valor, motivo);

              setPidiendoMotivo(null);
              if (!r.ok) {
                setAviso({ tone: "error", text: r.error ?? "No se pudo completar." });
                return;
              }
              setAviso({
                tone: "ok",
                text:
                  p.tipo === "estado"
                    ? p.valor
                      ? `${p.nombre} está activo de nuevo.`
                      : `${p.nombre} quedó suspendido.`
                    : p.valor
                      ? `Asistente IA activado en ${p.nombre}.`
                      : `Asistente IA apagado en ${p.nombre}.`,
              });
            });
          }}
        />
      )}
    </div>
  );
}

function AltaDialog({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: (r: Extract<AltaResult, { ok: true }>) => void;
}) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTocado, setSlugTocado] = useState(false);
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [accent, setAccent] = useState("#2E6BFF");
  const [vertical, setVertical] = useState<Vertical>("kiosco");
  const [aiAssistant, setAiAssistant] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  /** El slug se propone solo desde el nombre; si lo tocan, se respeta. */
  function onNombre(v: string) {
    setName(v);
    if (!slugTocado) {
      setSlug(
        v
          .toLowerCase()
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 40),
      );
    }
  }

  function guardar() {
    startTransition(async () => {
      const res = await crearNegocio({
        name,
        slug,
        ownerEmail,
        ownerName: ownerName || null,
        accent: accent || null,
        vertical,
        aiAssistant,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onDone(res);
    });
  }

  return (
    <Dialog title="Dar de alta un kiosco" onClose={onClose}>
      <div className="space-y-3">
        {error && (
          <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger-ink ring-1 ring-danger/25">
            {error}
          </p>
        )}

        <Campo id="sa-name" label="¿Cómo se llama el kiosco?">
          <input
            id="sa-name"
            value={name}
            onChange={(e) => onNombre(e.target.value)}
            autoFocus
            placeholder="Kiosco El Trébol"
            className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary"
          />
        </Campo>

        <Campo id="sa-slug" label="Dirección" hint="Se usa en el link del negocio.">
          <input
            id="sa-slug"
            value={slug}
            onChange={(e) => {
              setSlugTocado(true);
              setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
            }}
            className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary"
          />
        </Campo>

        <div className="flex gap-2">
          <div className="flex-1">
            <Campo id="sa-oname" label="Nombre del dueño">
              <input
                id="sa-oname"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="Jorge"
                className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary"
              />
            </Campo>
          </div>
          <div className="w-24">
            <Campo id="sa-accent" label="Color">
              <input
                id="sa-accent"
                type="color"
                value={accent}
                onChange={(e) => setAccent(e.target.value)}
                className="h-11 w-full cursor-pointer rounded-lg border border-input bg-background px-1"
              />
            </Campo>
          </div>
        </div>

        <Campo id="sa-email" label="Email del dueño" hint="Con este email va a entrar a la app.">
          <input
            id="sa-email"
            type="email"
            value={ownerEmail}
            onChange={(e) => setOwnerEmail(e.target.value)}
            placeholder="jorge@gmail.com"
            className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary"
          />
        </Campo>

        <Campo id="sa-vertical" label="Rubro" hint="Ajusta el vocabulario y los umbrales del asistente.">
          <select
            id="sa-vertical"
            value={vertical}
            onChange={(e) => setVertical(e.target.value as Vertical)}
            className="h-11 w-full cursor-pointer rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary"
          >
            {VERTICALES.map((v) => (
              <option key={v.value} value={v.value}>
                {v.label}
              </option>
            ))}
          </select>
        </Campo>

        {/* Add-on pago: el asistente que manda el reporte mensual por email. */}
        <button
          type="button"
          role="switch"
          aria-checked={aiAssistant}
          onClick={() => setAiAssistant((v) => !v)}
          className="flex w-full items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5 text-left transition-colors hover:border-primary/50"
        >
          <span
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-md transition-colors",
              aiAssistant ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground",
            )}
          >
            <Sparkles className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">Asistente IA</span>
            <span className="block text-xs text-muted-foreground">
              Reporte mensual del negocio por email. Add-on pago.
            </span>
          </span>
          <span
            className={cn(
              "relative h-5 w-9 shrink-0 rounded-full transition-colors",
              aiAssistant ? "bg-primary" : "bg-muted",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 size-4 rounded-full bg-white transition-all",
                aiAssistant ? "left-[18px]" : "left-0.5",
              )}
            />
          </span>
        </button>

        <button
          type="button"
          onClick={guardar}
          disabled={pending || !name.trim() || !slug || !ownerEmail}
          className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {pending && <LoaderCircle className="size-4 animate-spin" />}
          Crear el negocio
        </button>
      </div>
    </Dialog>
  );
}

/** Las credenciales se muestran UNA vez: la contraseña no se guarda en claro. */
function CredencialesDialog({
  alta,
  onClose,
}: {
  alta: Extract<AltaResult, { ok: true }> & { modo: "alta" | "reemision" };
  onClose: () => void;
}) {
  const [copiado, setCopiado] = useState(false);
  const esReemision = alta.modo === "reemision";
  const texto = `StockFlow — ${alta.store}\nEntrá con:\nEmail: ${alta.email}\nContraseña: ${alta.password}`;

  return (
    <Dialog
      title={esReemision ? `Contraseña nueva de ${alta.store}` : `${alta.store} está listo`}
      onClose={onClose}
    >
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {esReemision ? (
            <>
              Dictásela al dueño. La anterior{" "}
              <strong className="text-foreground">dejó de funcionar</strong> y se cerraron
              las sesiones que tuviera abiertas.
            </>
          ) : (
            <>
              Pasale estos datos al dueño. La contraseña es temporal y{" "}
              <strong className="text-foreground">no la vas a poder ver de nuevo</strong>.
            </>
          )}
        </p>

        <dl className="space-y-2 rounded-lg border border-border bg-background p-3">
          <div>
            <dt className="text-xs text-muted-foreground">Email</dt>
            <dd className="text-sm font-medium">{alta.email}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Contraseña temporal</dt>
            <dd className="tabular text-lg font-semibold">{alta.password}</dd>
          </div>
        </dl>

        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(texto);
            setCopiado(true);
          }}
          className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          {copiado ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copiado ? "Copiado" : "Copiar para mandarle"}
        </button>

        <button
          type="button"
          onClick={onClose}
          className="h-9 w-full cursor-pointer text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Ya se lo pasé
        </button>
      </div>
    </Dialog>
  );
}

function Campo({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Dialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/60 sm:place-items-center sm:p-4">
      <div className="max-h-[85dvh] w-full overflow-y-auto rounded-t-2xl border border-border bg-popover p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:max-w-sm sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="cursor-pointer text-muted-foreground hover:text-foreground">
            <X className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Qué acción está esperando su motivo. */
type PedidoDeMotivo = {
  storeId: string;
  nombre: string;
  tipo: "estado" | "ia" | "credenciales";
  /** Estado al que se va: suspendido→activo, IA on/off. Irrelevante en
      `credenciales`, que no es un toggle sino un acto de una sola dirección. */
  valor: boolean;
};

/**
 * El motivo, tipeado a mano, antes de tocar el negocio de un cliente.
 *
 * No es un confirm con un campo: el texto que se escribe acá lo LEE EL DUEÑO
 * en su pantalla. Por eso el placeholder muestra un motivo de verdad y no
 * "razón", y por eso el mínimo son 10 caracteres — "test" no le explica a
 * nadie por qué se quedó sin caja un martes.
 */
function DialogoDeMotivo({
  pedido,
  onCancelar,
  onConfirmar,
  pending,
}: {
  pedido: PedidoDeMotivo;
  onCancelar: () => void;
  onConfirmar: (motivo: string) => void;
  pending: boolean;
}) {
  const [motivo, setMotivo] = useState("");
  const suficiente = motivo.trim().length >= 10;

  const titulo =
    pedido.tipo === "credenciales"
      ? "Reemitir la contraseña de " + pedido.nombre
      : pedido.tipo === "estado"
        ? pedido.valor
          ? "Reactivar " + pedido.nombre
          : "Suspender " + pedido.nombre
        : pedido.valor
          ? "Activar el Asistente IA en " + pedido.nombre
          : "Desactivar el Asistente IA en " + pedido.nombre;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      {/* Este diálogo tiene un `textarea`, así que el teclado se abre SÍ O SÍ.
          Medido a 360 con el teclado puesto (viewport útil 350px): el diálogo
          entero medía 377px y "Confirmar" caía en 484 — inalcanzable, y sin
          confirmar el negocio no se suspende.
          Acotarlo no alcanzaba: con `max-h` el contenido entra pero el botón
          queda ABAJO DEL SCROLL. Por eso el cuerpo scrollea y las acciones van
          fijas al pie — que es la regla del responsive-audit para hojas, no una
          invención. */}
      <div className="flex max-h-[85dvh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-popover">
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <h2 className="text-lg font-semibold">{titulo}</h2>
        {pedido.tipo === "estado" && !pedido.valor && (
          /* Se dice lo que realmente pasa: suspender apaga la caja de un
             comercio que puede estar abierto con gente esperando. */
          <p className="mt-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning-ink">
            Deja de poder vender. Si está abierto, se entera en la próxima venta.
          </p>
        )}
        {pedido.tipo === "credenciales" && (
          /* Mismo criterio que suspender: se avisa ANTES lo que se rompe. Si
             el dueño está laburando en ese momento, la caja se le cae y tiene
             que volver a entrar con la clave nueva. */
          <p className="mt-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning-ink">
            La contraseña actual deja de andar y se cierran sus sesiones abiertas.
            Si está vendiendo, va a tener que volver a entrar.
          </p>
        )}
        <label htmlFor="motivo" className="mt-4 block text-sm font-medium">
          ¿Por qué?
        </label>
        <p className="mb-2 text-xs text-muted-foreground">
          Esto lo va a leer el dueño en su cuenta.
        </p>
        <textarea
          id="motivo"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          rows={3}
          autoFocus
          /* El ejemplo cambia con la acción: el de "falta de pago" no tiene
             nada que ver con reemitir una clave, y un placeholder que no
             corresponde enseña a escribir cualquier cosa. */
          placeholder={
            pedido.tipo === "credenciales"
              ? "Me llamó porque no puede entrar; perdió la contraseña."
              : "Falta de pago de la cuota de agosto, avisado por WhatsApp el 12."
          }
          className="w-full rounded-lg border border-input bg-card p-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          {suficiente ? "Listo." : "Faltan " + (10 - motivo.trim().length) + " caracteres."}
        </p>

        </div>

        {/* Fijas al pie: se ven siempre, con el teclado abierto o cerrado. */}
        <div className="flex shrink-0 justify-end gap-2 border-t border-border bg-popover px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onCancelar}
            className="h-10 cursor-pointer rounded-lg border border-border px-4 text-sm"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!suficiente || pending}
            onClick={() => onConfirmar(motivo.trim())}
            className="h-10 cursor-pointer rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Guardando…" : "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Pesos sin centavos: los montos de suscripción son redondos. */
function pesos(n: number): string {
  return "$" + Math.round(n).toLocaleString("es-AR");
}

/**
 * El estado de cobranza de un negocio, en la fila del panel.
 *
 * Es la primera de las tres preguntas de la semana ("¿quién me debe?"), así que
 * tiene que leerse SIN hacer click. El color no es decoración: es el criterio de
 * acción — rojo se reclama hoy, ámbar se mira, verde no se toca.
 */
function EstadoCobranza({
  sub,
  onMarcarPago,
  onEditarPlan,
  pending,
}: {
  sub: Suscripcion;
  onMarcarPago: () => void;
  onEditarPlan: () => void;
  pending: boolean;
}) {
  /* `sin_suscripcion` no se pinta de rojo: es un negocio al que todavía no se le
     armó el contrato, no uno que deba plata. Confundirlos haría que el panel
     grite por algo que se resuelve en 10 segundos. */
  if (sub.estado === "sin_suscripcion") {
    /* 062 · es el ÚNICO estado accionable de un solo click: crear el plan es
       lo que destraba todo lo demás (cobro, avisos, escalera). El resto de la
       edición vive detrás del engranaje, que se usa una vez por año. */
    return (
      <button
        type="button"
        disabled={pending}
        onClick={onEditarPlan}
        title="Asignarle un plan"
        className="shrink-0 cursor-pointer rounded-md border border-dashed border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground disabled:opacity-40"
      >
        sin plan
      </button>
    );
  }

  if (sub.estado === "cancelada") {
    return (
      <span className="shrink-0 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">
        de baja
      </span>
    );
  }

  if (sub.estado === "prueba") {
    return (
      <span
        className="shrink-0 rounded-md bg-primary/10 px-2 py-1 text-xs text-primary ring-1 ring-primary/25"
        title={`Gratis hasta el ${sub.prueba_hasta}`}
      >
        prueba
      </span>
    );
  }

  if (sub.estado === "al_dia") {
    return (
      <button
        type="button"
        disabled={pending}
        onClick={onMarcarPago}
        title="Marcar un pago"
        className="shrink-0 cursor-pointer rounded-md bg-success/10 px-2 py-1 text-xs text-success-ink ring-1 ring-success/25 transition-opacity hover:opacity-80 disabled:opacity-40"
      >
        al día
      </button>
    );
  }

  /* Debe. Se muestran las DOS cosas que deciden qué hacer: cuánto y desde hace
     cuánto. "Debe $120.000" sin el tiempo no dice si hay que llamar o esperar;
     "45 días" sin el monto no dice si vale la pena. */
  return (
    <button
      type="button"
      disabled={pending}
      onClick={onMarcarPago}
      title={
        (sub.parcial ? "Pagó una parte. " : "") +
        `${sub.meses_impagos} mes(es) sin saldar, desde ${sub.desde}`
      }
      className={cn(
        "shrink-0 cursor-pointer rounded-md px-2 py-1 text-xs font-medium ring-1 transition-opacity hover:opacity-80 disabled:opacity-40",
        /* Un parcial no es un moroso: pagó, le falta. Mismo dato, otra llamada. */
        sub.parcial
          ? "bg-warning/10 text-warning-ink ring-warning/30"
          : "bg-danger/10 text-danger-ink ring-danger/30",
      )}
    >
      {sub.parcial ? "falta" : "debe"} {pesos(sub.deuda)} · {sub.dias_de_atraso}d
    </button>
  );
}

/**
 * Marcar el pago de un mes.
 *
 * Dos decisiones de diseño que evitan errores caros:
 *
 * 1 · El PERÍODO viene pre-elegido con el mes más viejo impago, no con el mes
 *     actual. Es lo que uno quiere el 95% de las veces —se cobra la deuda más
 *     vieja primero— y si se dejara el actual, marcar un pago con dos meses
 *     debidos saldaría el mes equivocado sin que nadie lo note.
 *
 * 2 · El MONTO viene con el precio del plan, editable. Un cliente puede pagar de
 *     menos y eso hay que poder asentarlo tal cual: forzar el monto exacto
 *     obligaría a mentirle a la base para que cierre.
 */
function DialogoDePago({
  nombre,
  sub,
  onCancelar,
  onConfirmar,
  pending,
}: {
  nombre: string;
  sub: Suscripcion;
  onCancelar: () => void;
  onConfirmar: (periodo: string, monto: number, nota?: string) => void;
  pending: boolean;
}) {
  /* 058 · se propone lo que FALTA del mes más viejo, no el precio entero: si
     ya pagó una parte, ofrecer el total lleva derecho al error
     `monto_excede_lo_adeudado`. */
  const precio = sub.estado === "debe" ? Math.min(sub.deuda, sub.precio) : "precio" in sub ? sub.precio : 0;
  const sugerido = sub.estado === "debe" ? sub.desde : new Date().toISOString().slice(0, 8) + "01";

  const [periodo, setPeriodo] = useState(sugerido);
  const [monto, setMonto] = useState(String(Math.round(precio)));
  const [nota, setNota] = useState("");

  const montoNum = Number(monto);
  const valido = /^\d{4}-\d{2}-\d{2}$/.test(periodo) && Number.isFinite(montoNum) && montoNum >= 0;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div className="flex max-h-[85dvh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-popover">
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <h2 className="text-lg font-semibold">Registrar pago · {nombre}</h2>
          {sub.estado === "debe" && (
            <p className="mt-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning-ink">
              Debe {sub.meses_impagos} mes{sub.meses_impagos === 1 ? "" : "es"} desde {sub.desde}.
              Se salda el más viejo primero.
            </p>
          )}

          <label htmlFor="periodo" className="mt-4 block text-sm font-medium">
            Mes que paga
          </label>
          <p className="mb-2 text-xs text-muted-foreground">
            El mes que queda saldado, no la fecha en que transfirió.
          </p>
          <input
            id="periodo"
            type="date"
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value)}
            className="w-full rounded-lg border border-input bg-card p-3 text-sm outline-none focus:border-primary"
          />

          <label htmlFor="monto" className="mt-4 block text-sm font-medium">
            Monto
          </label>
          <input
            id="monto"
            type="number"
            inputMode="numeric"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            className="tabular w-full rounded-lg border border-input bg-card p-3 text-sm outline-none focus:border-primary"
          />

          <label htmlFor="nota-pago" className="mt-4 block text-sm font-medium">
            Nota <span className="font-normal text-muted-foreground">(opcional)</span>
          </label>
          <input
            id="nota-pago"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Transferencia del 12/09, comprobante 4471"
            className="w-full rounded-lg border border-input bg-card p-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
          />
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-border bg-popover px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onCancelar}
            className="h-10 cursor-pointer rounded-lg border border-border px-4 text-sm"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!valido || pending}
            onClick={() => onConfirmar(periodo, montoNum, nota.trim() || undefined)}
            className="h-10 cursor-pointer rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Guardando…" : "Registrar pago"}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Una de las cifras de la semana.
 *
 * Reusa la gramática del panel del dueño (`Card` + `CardLabel` + `tabular`) en
 * vez de inventar una card propia: que el panel de SYNTRA se vea como el
 * producto no es coquetería, es lo que hace que un cambio en el sistema de
 * cards llegue también acá.
 *
 * `tabular` en el número es lo que permite compararlos de un vistazo entre
 * cards; con cifras proporcionales, tres montos del mismo largo se ven de
 * anchos distintos.
 */
function Cifra({
  label,
  valor,
  nota,
  tono = "neutro",
}: {
  label: string;
  valor: string;
  nota?: string;
  tono?: "neutro" | "danger";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-4",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
        tono === "danger" ? "border-danger/30 bg-danger/[0.06]" : "border-border bg-card",
      )}
    >
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "tabular mt-1 text-2xl font-semibold",
          tono === "danger" ? "text-danger-ink" : "text-foreground",
        )}
      >
        {valor}
      </p>
      {nota && <p className="mt-0.5 text-xs text-muted-foreground">{nota}</p>}
    </div>
  );
}

/**
 * La columna de seguimiento.
 *
 * 066 dejó anotar el contacto y agendar cuándo volver a llamar, pero eso vivía
 * SÓLO adentro de la ficha: una fecha para el 28 no se veía en ningún lado a
 * menos que entraras al cliente. Una agenda que obliga a abrir de a uno no
 * sirve para planificar la semana, que es para lo que se anotó.
 *
 * Tres estados, en orden de urgencia:
 *  · hay fecha agendada  → la fecha, que es un compromiso con uno mismo;
 *  · debe y nunca se lo contactó → ámbar, porque es el caso más fácil de
 *    resolver (quizás sólo no se enteró) y el más fácil de que se pase;
 *  · hubo contacto → hace cuánto.
 */
function Seguimiento({
  seguimientoEl,
  ultimoContacto,
  contactos,
  debe,
}: {
  seguimientoEl: string | null;
  ultimoContacto: string | null;
  contactos: number;
  debe: boolean;
}) {
  if (seguimientoEl) {
    return (
      <span className="flex shrink-0 items-center gap-1.5 text-xs text-foreground">
        <BellRing className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        {new Date(seguimientoEl + "T00:00:00").toLocaleDateString("es-AR", {
          day: "numeric",
          month: "short",
        })}
      </span>
    );
  }

  if (!ultimoContacto) {
    /* Sólo se marca en ámbar si DEBE: en un cliente al día, no haberlo
       contactado nunca es lo normal y teñirlo sería una alarma falsa. */
    return debe ? (
      <span className="shrink-0 text-xs text-warning-ink">Nunca contactado</span>
    ) : (
      <span className="shrink-0 text-xs text-muted-foreground">—</span>
    );
  }

  return (
    <span
      className="shrink-0 text-xs text-muted-foreground"
      title={new Date(ultimoContacto).toLocaleString("es-AR")}
    >
      {haceCuanto(ultimoContacto)}
      {contactos > 1 && ` · ${contactos}`}
    </span>
  );
}
