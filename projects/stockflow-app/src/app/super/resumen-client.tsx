"use client";

import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { cn } from "@/lib/cn";
import type { StoreRow } from "./super-client";

export type MesIngreso = {
  mes: string;
  comprometido: number;
  cobrado: number;
  pagaron: number;
  enCurso: boolean;
};

export type CobradoCliente = {
  storeId: string;
  nombre: string;
  mes: string;
  cobrado: number;
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
const MES_CORTO = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/* Mismo tooltip que los reportes del dueño: que el panel de SYNTRA y el
   producto se lean igual no es coquetería — un cambio en la gramática visual
   tiene que llegar a los dos lados. */
const TOOLTIP = {
  cursor: { fill: "var(--secondary)", opacity: 0.4 },
  contentStyle: {
    background: "var(--popover)",
    border: "1px solid var(--border)",
    borderRadius: "0.5rem",
    fontSize: "0.8rem",
  },
  labelStyle: { color: "var(--foreground)" },
  itemStyle: { color: "var(--foreground)" },
} as const;

const kFmt = (v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v));

/**
 * Resumen — la plata de SYNTRA.
 *
 * OTRA CADENCIA QUE EL RESTO DEL PANEL. La cartera se mira los lunes para
 * decidir a quién llamar; esto se mira una vez por mes para decidir si el
 * negocio va para algún lado. Por eso es la única sección con filtros de
 * período: las otras dos hablan de HOY.
 *
 * TODO SE FILTRA EN MEMORIA. Las dos consultas traen 36 meses acotados de una
 * sola vez, así que cambiar de mes o de año es instantáneo y no vuelve al
 * servidor. A esta escala (36 filas + clientes×36) es más barato que un
 * round-trip por click, y el techo está en la RPC, no en la confianza.
 */
export function Resumen({
  meses,
  porCliente,
  stores,
}: {
  meses: MesIngreso[];
  porCliente: CobradoCliente[];
  stores: StoreRow[];
}) {
  /* Los años que realmente tienen datos, del más nuevo al más viejo. Ofrecer
     un desplegable con años vacíos es invitar a mirar una pantalla en cero y
     creer que el sistema no anda. */
  const anios = useMemo(() => {
    const set = new Set(meses.map((m) => Number(m.mes.slice(0, 4))));
    if (set.size === 0) set.add(new Date().getUTCFullYear());
    return [...set].sort((a, b) => b - a);
  }, [meses]);

  const [anio, setAnio] = useState(anios[0]);
  /* -1 = todo el año. Es el default porque la pregunta de esta pantalla es
     anual ("¿crezco?"); el mes puntual es el zoom, no la vista. */
  const [mes, setMes] = useState(-1);

  const delAnio = useMemo(
    () => meses.filter((m) => Number(m.mes.slice(0, 4)) === anio),
    [meses, anio],
  );

  const periodo = useMemo(
    () => (mes === -1 ? delAnio : delAnio.filter((m) => Number(m.mes.slice(5, 7)) - 1 === mes)),
    [delAnio, mes],
  );

  const cobrado = periodo.reduce((t, m) => t + m.cobrado, 0);
  const comprometido = periodo.reduce((t, m) => t + m.comprometido, 0);
  const sinCobrar = Math.max(comprometido - cobrado, 0);
  /* Sin denominador no hay porcentaje: un "0%" cuando no había nada que cobrar
     es una nota mala inventada. Se muestra un guion y el porqué. */
  const efectividad = comprometido > 0 ? Math.round((cobrado / comprometido) * 100) : null;

  const clientesDelPeriodo = useMemo(() => {
    const enPeriodo = porCliente.filter((c) => {
      const a = Number(c.mes.slice(0, 4));
      const m = Number(c.mes.slice(5, 7)) - 1;
      return a === anio && (mes === -1 || m === mes);
    });
    const acc = new Map<string, { nombre: string; total: number }>();
    enPeriodo.forEach((c) => {
      const prev = acc.get(c.storeId);
      acc.set(c.storeId, { nombre: c.nombre, total: (prev?.total ?? 0) + c.cobrado });
    });
    return [...acc.values()].sort((a, b) => b.total - a.total);
  }, [porCliente, anio, mes]);

  const etiquetaPeriodo = mes === -1 ? `${anio}` : `${MESES[mes]} de ${anio}`;

  return (
    <div className="space-y-5">
      {/* ── Filtros ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="filtro-anio">
          Año
        </label>
        <select
          id="filtro-anio"
          value={anio}
          onChange={(e) => setAnio(Number(e.target.value))}
          className="h-9 cursor-pointer rounded-lg border border-input bg-card px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {anios.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>

        <label className="sr-only" htmlFor="filtro-mes">
          Mes
        </label>
        <select
          id="filtro-mes"
          value={mes}
          onChange={(e) => setMes(Number(e.target.value))}
          className="h-9 cursor-pointer rounded-lg border border-input bg-card px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <option value={-1}>Todo el año</option>
          {MESES.map((m, i) => (
            <option key={m} value={i}>
              {m[0].toUpperCase() + m.slice(1)}
            </option>
          ))}
        </select>

        <span className="text-xs text-muted-foreground">
          Mostrando {etiquetaPeriodo}
        </span>
      </div>

      {/* ── Las cuatro cifras ───────────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Cifra
          tono="success"
          label="Cobrado"
          valor={pesos(cobrado)}
          desc="Plata que efectivamente entró en el período."
        />
        <Cifra
          tono="danger"
          label="Sin cobrar"
          valor={pesos(sinCobrar)}
          desc="Se facturó y todavía no entró. Es la mora del período."
        />
        <Cifra
          tono="warning"
          label="Efectividad de cobro"
          valor={efectividad === null ? "—" : `${efectividad}%`}
          desc={
            efectividad === null
              ? "Todavía no hubo nada que cobrar en este período."
              : "Qué parte de lo facturado terminó entrando."
          }
        />
        <Cifra
          tono="primary"
          label="Clientes que pagaron"
          valor={String(clientesDelPeriodo.length)}
          desc={
            mes === -1
              ? "Cuántos clientes distintos pagaron al menos un mes."
              : "Cuántos clientes pagaron este mes."
          }
        />
      </div>

      {/* ── Serie mensual ───────────────────────────────────────────────── */}
      <Bloque
        titulo="Comprometido contra cobrado, mes a mes"
        desc="La altura de cada barra es lo que había que cobrar ese mes; la parte llena, lo que entró. El bloque gris de arriba es lo que falta."
      >
        {delAnio.every((m) => m.comprometido === 0 && m.cobrado === 0) ? (
          <Vacio>Todavía no hay ningún mes facturado en {anio}.</Vacio>
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={delAnio.map((m) => ({
                  name: MES_CORTO[Number(m.mes.slice(5, 7)) - 1],
                  Cobrado: m.cobrado,
                  /* Se APILA "lo que falta", no se dibuja el comprometido
                     encima. Es la única forma de que la altura total sea el
                     comprometido y la parte llena sea lo cobrado: dos barras
                     superpuestas con `barGap` negativo no se enciman por
                     categoría —se pisan entre meses— y el gráfico queda
                     ilegible. Apilado, el hueco de arriba ES la deuda. */
                  "Falta cobrar": Math.max(m.comprometido - m.cobrado, 0),
                }))}
                margin={{ top: 4, right: 4, bottom: 0, left: -18 }}
                /* Sin techo, con 12 categorías en un desktop ancho cada barra
                   mide ~90px y el gráfico parece un tablero de bloques. 48px
                   mantiene la proporción de barra sin importar el ancho. */
                maxBarSize={48}
              >
                <XAxis
                  dataKey="name"
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={kFmt}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip {...TOOLTIP} formatter={(v, n) => [pesos(Number(v ?? 0)), String(n)]} />
                {/* Las dos series SUPERPUESTAS (`barGap` negativo) y no lado a
                    lado: apiladas al lado, comparar exige mirar dos alturas
                    distintas y hacer la resta con el ojo. Encimadas, el hueco
                    que queda arriba ES la deuda — se ve sin leer nada. */}
                <Bar dataKey="Cobrado" stackId="m">
                  {delAnio.map((m) => (
                    <Cell
                      key={m.mes}
                      /* El mes EN CURSO va en otro tono: todavía se está
                         cobrando, así que verlo corto no significa mora. Sin
                         esta distinción, todos los días 3 el panel parece una
                         catástrofe. */
                      fill={m.enCurso ? "var(--primary)" : "var(--success)"}
                    />
                  ))}
                </Bar>
                <Bar dataKey="Falta cobrar" stackId="m" fill="var(--secondary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        <Leyenda
          items={[
            { color: "var(--success)", label: "Cobrado" },
            { color: "var(--secondary)", label: "Falta cobrar" },
            { color: "var(--primary)", label: "Mes en curso" },
          ]}
        />
      </Bloque>

      <div className="grid gap-5 lg:grid-cols-2">
        <CarteraDonut stores={stores} />
        <PorCliente clientes={clientesDelPeriodo} periodo={etiquetaPeriodo} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   PIEZAS
   ═════════════════════════════════════════════════════════════════════════ */

const TONOS = {
  success: { borde: "border-success/30", fondo: "bg-success/[0.07]", texto: "text-success-ink" },
  danger: { borde: "border-danger/30", fondo: "bg-danger/[0.07]", texto: "text-danger-ink" },
  warning: { borde: "border-warning/30", fondo: "bg-warning/[0.07]", texto: "text-warning-ink" },
  primary: { borde: "border-primary/30", fondo: "bg-primary/[0.07]", texto: "text-primary-ink" },
} as const;

/**
 * Una cifra con su descripción.
 *
 * La descripción no es relleno: "Cobrado" y "Comprometido" son dos números
 * parecidos que significan cosas opuestas, y sin el renglón que lo aclara el
 * que mira tiene que acordarse de cuál era cuál. Es la diferencia entre un
 * tablero que se entiende solo y uno que hay que explicar cada vez.
 *
 * Cada tono es semántico y no decorativo: verde = plata que entró (el único
 * lugar de este panel donde el verde corresponde, porque acá SÍ es plata real
 * cobrada), rojo = lo que falta, ámbar = una proporción que mirar, azul = un
 * conteo neutro.
 */
function Cifra({
  label,
  valor,
  desc,
  tono,
}: {
  label: string;
  valor: string;
  desc: string;
  tono: keyof typeof TONOS;
}) {
  const t = TONOS[tono];
  return (
    <div className={cn("rounded-xl border p-4", t.borde, t.fondo)}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={cn("tabular mt-1 text-2xl font-semibold", t.texto)}>{valor}</p>
      <p className="mt-1 text-xs leading-snug text-muted-foreground">{desc}</p>
    </div>
  );
}

function Bloque({
  titulo,
  desc,
  children,
}: {
  titulo: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-4 lg:p-5">
      <h2 className="text-sm font-semibold">{titulo}</h2>
      <p className="mb-3 mt-0.5 text-xs leading-snug text-muted-foreground">{desc}</p>
      {children}
    </section>
  );
}

function Vacio({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid h-40 place-items-center rounded-lg border border-dashed border-border px-4 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

/**
 * La leyenda, con cuadrito Y texto.
 *
 * El color no puede ser el único portador del dato (regla de accesibilidad):
 * quien no distingue verde de rojo tiene que poder leer la misma información.
 */
function Leyenda({ items }: { items: { color: string; label: string }[] }) {
  return (
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span
            aria-hidden
            className="size-2.5 shrink-0 rounded-[3px]"
            style={{ background: i.color }}
          />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

/** Los cinco estados de la cartera, con color semántico. */
const ESTADOS = [
  { id: "al_dia", label: "Al día", color: "var(--success)" },
  { id: "debe", label: "Deben", color: "var(--danger)" },
  { id: "prueba", label: "En prueba", color: "var(--primary)" },
  { id: "sin_suscripcion", label: "Sin plan", color: "#93a5c0" },
  { id: "cancelada", label: "De baja", color: "#4a5b78" },
] as const;

/**
 * Composición de la cartera.
 *
 * Es la ÚNICA torta de la sección, y con cinco porciones como máximo — que es
 * el techo que la propia guía de accesibilidad marca para una torta. El resto
 * de los datos son series o comparaciones, y ahí una torta miente.
 *
 * Va acompañada de la lista con conteo: la torta da la proporción de un
 * vistazo, la lista da el número exacto. Ninguna de las dos sola alcanza.
 */
function CarteraDonut({ stores }: { stores: StoreRow[] }) {
  const datos = ESTADOS.map((e) => ({
    ...e,
    valor: stores.filter((s) => s.suscripcion.estado === e.id).length,
  })).filter((d) => d.valor > 0);

  const total = datos.reduce((t, d) => t + d.valor, 0);

  return (
    <Bloque
      titulo="Cómo está la cartera hoy"
      desc="En qué situación está cada cliente en este momento. No depende del período elegido: es una foto de hoy."
    >
      {total === 0 ? (
        <Vacio>Todavía no hay ningún negocio.</Vacio>
      ) : (
        <div className="flex flex-col items-center gap-5 sm:flex-row">
          <div className="relative h-40 w-40 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip
                  {...TOOLTIP}
                  formatter={(v, n) => [`${v} ${Number(v) === 1 ? "negocio" : "negocios"}`, String(n)]}
                />
                <Pie
                  data={datos.map((d) => ({ name: d.label, value: d.valor, fill: d.color }))}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="62%"
                  outerRadius="92%"
                  paddingAngle={3}
                  cornerRadius={4}
                  stroke="var(--card)"
                  strokeWidth={2}
                >
                  {datos.map((d) => (
                    <Cell key={d.id} fill={d.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <div className="text-center">
                <p className="tabular text-xl font-semibold">{total}</p>
                <p className="text-[11px] text-muted-foreground">
                  {total === 1 ? "negocio" : "negocios"}
                </p>
              </div>
            </div>
          </div>

          <ul className="w-full space-y-1.5">
            {datos.map((d) => (
              <li key={d.id} className="flex items-center gap-2 text-sm">
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-[3px]"
                  style={{ background: d.color }}
                />
                <span className="flex-1 text-muted-foreground">{d.label}</span>
                <span className="tabular font-medium">{d.valor}</span>
                <span className="tabular w-10 text-right text-xs text-muted-foreground">
                  {Math.round((d.valor / total) * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Bloque>
  );
}

/* Paleta NO semántica: acá los colores sólo separan clientes entre sí, no
   significan nada. Por eso no se reusan los tokens de estado — teñir a un
   cliente de rojo porque le tocó el cuarto lugar sugeriría que algo anda mal. */
const COLORES_CLIENTE = ["#6d9bff", "#2e6bff", "#7c5cff", "#00b4d8", "#4a5b78"];

/**
 * De dónde viene la plata.
 *
 * Barras HORIZONTALES y no verticales: los nombres de los negocios son largos
 * ("Kiosco Doña Rosa") y en vertical hay que rotarlos o cortarlos. Acá el
 * nombre se lee de corrido y la barra crece hacia donde hay lugar.
 *
 * Sin recharts a propósito: son divs con un ancho porcentual. Una librería de
 * gráficos para dibujar cinco rectángulos con su etiqueta agrega ejes,
 * responsive container y tooltip para no resolver nada que el CSS no resuelva.
 */
function PorCliente({
  clientes,
  periodo,
}: {
  clientes: { nombre: string; total: number }[];
  periodo: string;
}) {
  const max = clientes.reduce((m, c) => Math.max(m, c.total), 0);
  const total = clientes.reduce((t, c) => t + c.total, 0);

  return (
    <Bloque
      titulo="De dónde viene la plata"
      desc={`Cuánto aportó cada cliente en ${periodo}. Sirve para saber cuánto dolería que se vaya alguno.`}
    >
      {clientes.length === 0 ? (
        <Vacio>Ningún pago asentado en este período.</Vacio>
      ) : (
        <ul className="space-y-2.5">
          {clientes.map((c, i) => (
            <li key={c.nombre}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="min-w-0 truncate">{c.nombre}</span>
                <span className="tabular shrink-0 font-medium">{pesos(c.total)}</span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${max > 0 ? Math.max((c.total / max) * 100, 2) : 0}%`,
                      background: COLORES_CLIENTE[i % COLORES_CLIENTE.length],
                    }}
                  />
                </div>
                <span className="tabular w-9 shrink-0 text-right text-xs text-muted-foreground">
                  {total > 0 ? Math.round((c.total / total) * 100) : 0}%
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Bloque>
  );
}
