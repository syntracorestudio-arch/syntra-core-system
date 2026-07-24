"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  Cell,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Minus,
  Package,
  Trash2,
  Wallet,
  Info,
  Lock,
  ChartColumn,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyArt } from "@/components/ui/empty-art";
import { Card, CardHero } from "@/components/ui/card-system";
import { money, signedPct } from "@/lib/format";

export type Periodo = "semana" | "mes" | "anio";

export type ReportesData = {
  period: { from: string; to: string; days: number; days_of_use: number };
  money: {
    sold: number; tickets: number; units: number; profit: number;
    margin_pct: number | null; cost_coverage: number | null;
    purchased: number; shelf_value: number;
    prev_sold: number; prev_units: number; vs_prev_pct: number | null;
  };
  by_date: { fecha: string; total: number }[];
  top_units: { product_id: string; name: string; emoji: string | null; units: number; revenue: number }[];
  top_profit: { product_id: string; name: string; emoji: string | null; profit: number; units: number; margin_pct: number | null }[];
  by_category: { name: string; color: string | null; revenue: number; profit: number }[];
  by_weekday: { dow: number; total: number; dias: number }[];
  by_slot: { orden: number; name: string; total: number; tickets: number }[];
  dead_stock: { total: number; items: { product_id: string; name: string; emoji: string | null; stock: number; parado: number }[] };
  waste: { total: number; items: { name: string; emoji: string | null; unidades: number; perdido: number }[] };
  credit: { given: number; collected: number; overdue: { client_id: string; name: string; owed: number; dias: number }[] };
  data_health: { cost_coverage: number | null; products_without_cost: number; stale_prices: number };
};

const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

/** Cada métrica tiene su propio umbral: mostrarla antes sería inventar. */
const UMBRALES = {
  comparacion: 14,
  ritmos: 21,
  stockMuerto: 30,
  fiadoViejo: 30,
} as const;

export function ReportesClient({
  data,
  periodo,
  offset,
  from,
  to,
}: {
  data: ReportesData | null;
  periodo: Periodo;
  offset: number;
  from: string;
  to: string;
}) {
  const router = useRouter();

  if (!data) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 lg:px-8">
        <p className="text-sm text-muted-foreground">No pudimos cargar los reportes.</p>
      </div>
    );
  }

  const { money: m, period } = data;
  const dias = period.days_of_use;
  const sinDatos = m.tickets === 0;

  function ir(p: Periodo, o: number) {
    router.push(`/admin/reportes?p=${p}&o=${o}`);
  }

  const etiqueta = new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  const rangoTexto =
    periodo === "anio"
      ? from.slice(0, 4)
      : `${etiqueta.format(new Date(from))} – ${etiqueta.format(new Date(to))}`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8 lg:py-8">
      <div className="mb-4">
        <PageHeader
          title="Cómo viene el negocio"
          subtitle={rangoTexto}
          icon={ChartColumn}
          art="reportes"
        />
      </div>

      {/* Selector: segmented control con thumb deslizante (auditoría parte C)
          + flechas de 44px táctiles. Sin dropdown de 12 meses ni fechas
          tipeadas en el teléfono. */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="relative grid grid-cols-3 rounded-lg border border-border bg-[#0e1420] p-1">
          {/* thumb: se desliza al segmento activo */}
          <span
            aria-hidden
            className="absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/3)] rounded-md bg-[#1c2637] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-transform duration-200 ease-out"
            style={{
              transform: `translateX(${(["semana", "mes", "anio"] as const).indexOf(periodo) * 100}%)`,
            }}
          />
          {(
            [
              ["semana", "Semana"],
              ["mes", "Mes"],
              ["anio", "Año"],
            ] as const
          ).map(([key, label]) => {
            const bloqueado = key === "anio" && dias < 90;
            return (
              <button
                key={key}
                type="button"
                disabled={bloqueado}
                onClick={() => ir(key, 0)}
                title={bloqueado ? "Vas a poder verlo cuando tengas 3 meses de uso" : undefined}
                className={cn(
                  "relative z-10 h-10 cursor-pointer rounded-md px-4 text-sm font-medium transition-colors",
                  periodo === key ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                  bloqueado && "cursor-not-allowed opacity-40",
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => ir(periodo, offset - 1)}
            aria-label="Período anterior"
            className="grid h-11 w-11 cursor-pointer place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            disabled={offset >= 0}
            onClick={() => ir(periodo, offset + 1)}
            aria-label="Período siguiente"
            className="grid h-11 w-11 cursor-pointer place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      {/* Salud de los datos arriba de todo: sin costos cargados, media pantalla
          es ficción y es preferible admitirlo que decorarlo. */}
      {m.cost_coverage !== null && m.cost_coverage < 90 && (
        <div className="mb-4 flex items-start gap-2 rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning-ink ring-1 ring-warning/25">
          <Info className="mt-0.5 size-4 shrink-0" />
          <span className="flex-1">
            Solo el {m.cost_coverage}% de lo que vendiste tiene costo cargado, así que la
            ganancia real es mayor.{" "}
            {data.data_health.products_without_cost > 0 && (
              <Link href="/admin/productos" className="underline">
                Cargar costos ({data.data_health.products_without_cost} productos)
              </Link>
            )}
          </span>
        </div>
      )}

      {sinDatos ? (
        <div className="rounded-xl border border-dashed border-border px-6 py-14 text-center">
          <EmptyArt name="reportes" alt="Un gráfico de barras" />
          <p className="text-sm font-medium">No hay ventas en este período</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Probá con otro período o empezá a vender desde la caja.
          </p>
        </div>
      ) : (
        <>
          {/* ---------------- A. La plata ---------------- */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Los dos números que importan van como HEROES; el sparkline le da
                la tendencia del período sin abrir el gráfico grande. */}
            <CardHero className="p-4 lg:p-4">
              <h2 className="text-sm font-medium text-muted-foreground">Vendiste</h2>
              <p className="tabular mt-1 text-2xl font-semibold">{money(m.sold)}</p>
              <div className="mt-1.5">
                {dias >= UMBRALES.comparacion ? (
                  <Comparacion pct={m.vs_prev_pct} unidadesAhora={m.units} unidadesAntes={m.prev_units} />
                ) : (
                  <Dormida faltan={UMBRALES.comparacion - dias} que="comparar con el período anterior" />
                )}
              </div>
              {data.by_date.length >= 5 && <Spark data={data.by_date} />}
            </CardHero>

            <CardHero glow="success" className="p-4 lg:p-4">
              <h2 className="text-sm font-medium text-muted-foreground">
                Ganancia sobre la mercadería
              </h2>
              <p className="tabular mt-1 text-2xl font-semibold text-success-ink">
                {m.margin_pct === null ? "—" : money(m.profit)}
              </p>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {m.margin_pct === null
                  ? "Cargá costos para verla"
                  : `Margen ${m.margin_pct}% · no incluye alquiler ni servicios`}
              </p>
            </CardHero>

            <Metric label="Compraste mercadería" valor={money(m.purchased)}>
              <span className="text-xs text-muted-foreground">
                {m.purchased > m.sold
                  ? "Compraste más de lo que vendiste: la plata está en la góndola."
                  : "Lo que pusiste en stock este período."}
              </span>
            </Metric>

            <Metric label="Plata en la góndola" valor={money(m.shelf_value)}>
              <span className="text-xs text-muted-foreground">
                Tu stock actual valuado a lo que te costó.
              </span>
            </Metric>
          </div>

          {/* Evolución: tendencia → área con línea, no barras (la forma la
              elige el trabajo del dato). */}
          <Panel title="Cómo se movió" className="mt-4">
            <AreaTrend
              data={data.by_date.map((d) => ({
                name: periodo === "anio" ? d.fecha.slice(5) : d.fecha.slice(8),
                Facturación: Number(d.total),
              }))}
            />
          </Panel>

          {/* ---------------- B. Qué conviene vender ---------------- */}
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Panel title="Lo que más vendés" subtitle="Por unidades">
              <Ranking
                items={data.top_units.map((p) => ({
                  id: p.product_id,
                  emoji: p.emoji,
                  name: p.name,
                  principal: `${Number(p.units)}u`,
                  secundario: money(Number(p.revenue)),
                }))}
              />
            </Panel>

            <Panel title="Lo que más te deja" subtitle="Por ganancia en pesos">
              {data.top_profit.length === 0 ? (
                <Vacio>Cargá el costo de tus productos para ver cuál te deja más.</Vacio>
              ) : (
                <Ranking
                  items={data.top_profit.map((p) => ({
                    id: p.product_id,
                    emoji: p.emoji,
                    name: p.name,
                    principal: money(Number(p.profit)),
                    secundario: `${Number(p.units)}u · ${p.margin_pct}%`,
                    tono: "success" as const,
                  }))}
                />
              )}
            </Panel>
          </div>

          {data.by_category.length >= 2 && (
            <Panel
              title="Por categoría"
              subtitle="La barra es lo que facturaste; el relleno verde, lo que te quedó"
              className="mt-4"
            >
              <CategoriasAnidadas cats={data.by_category} />
            </Panel>
          )}

          {/* ---------------- C. Cuándo vendés ---------------- */}
          {dias >= UMBRALES.ritmos ? (
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <Panel title="Qué días vendés más" subtitle="El día fuerte, a todo color">
                <DiasChart
                  data={data.by_weekday.map((d) => ({
                    name: DIAS[d.dow],
                    Promedio: d.dias > 0 ? Math.round(Number(d.total) / d.dias) : 0,
                  }))}
                />
              </Panel>
              <Panel title="A qué hora vendés" subtitle="Proporción del total del período">
                <SlotDonut slots={data.by_slot} />
              </Panel>
            </div>
          ) : (
            <Panel title="Cuándo vendés más" className="mt-4">
              <Dormida faltan={UMBRALES.ritmos - dias} que="ver tus días y horarios fuertes" />
            </Panel>
          )}

          {/* ---------------- D. Dónde se te escapa la plata ---------------- */}
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Panel
              title="Plata parada en la góndola"
              subtitle={dias >= UMBRALES.stockMuerto ? "Sin vender hace más de 30 días" : undefined}
              icon={Package}
            >
              {dias < UMBRALES.stockMuerto ? (
                <Dormida faltan={UMBRALES.stockMuerto - dias} que="detectar el stock que no rota" />
              ) : data.dead_stock.items.length === 0 ? (
                <Vacio>Todo tu stock rotó en los últimos 30 días.</Vacio>
              ) : (
                <>
                  <p className="tabular mb-3 text-2xl font-semibold text-warning-ink">
                    {money(Number(data.dead_stock.total))}
                  </p>
                  <Ranking
                    items={data.dead_stock.items.slice(0, 5).map((p) => ({
                      id: p.product_id,
                      emoji: p.emoji,
                      name: p.name,
                      principal: money(Number(p.parado)),
                      secundario: `${Number(p.stock)}u sin vender`,
                    }))}
                  />
                </>
              )}
            </Panel>

            <Panel title="Perdiste por vencimientos" icon={Trash2}>
              {Number(data.waste.total) === 0 ? (
                <Vacio>No tiraste nada en este período.</Vacio>
              ) : (
                <>
                  <p className="tabular mb-3 text-2xl font-semibold text-danger-ink">
                    {money(Number(data.waste.total))}
                  </p>
                  <Ranking
                    items={data.waste.items.map((w, i) => ({
                      id: String(i),
                      emoji: w.emoji,
                      name: w.name,
                      principal: money(Number(w.perdido)),
                      secundario: `${Number(w.unidades)}u`,
                      tono: "danger" as const,
                    }))}
                  />
                </>
              )}
            </Panel>
          </div>

          <Panel
            title="Fiado del período"
            subtitle="El hueco entre las dos barras es lo que falta cobrar"
            icon={Wallet}
            className="mt-4"
          >
            <FiadoPareado given={Number(data.credit.given)} collected={Number(data.credit.collected)} />
            {dias >= UMBRALES.fiadoViejo && data.credit.overdue.length > 0 && (
              <div className="mt-4 border-t border-border pt-3">
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  Sin moverse hace más de 30 días
                </p>
                <ul className="divide-y divide-border">
                  {data.credit.overdue.map((c) => (
                    <li key={c.client_id}>
                      <Link
                        href={`/admin/fiado/${c.client_id}`}
                        className="flex items-center justify-between py-2 text-sm transition-colors hover:text-primary-ink"
                      >
                        <span className="min-w-0 flex-1 truncate">{c.name}</span>
                        <span className="tabular shrink-0 text-xs text-muted-foreground">
                          hace {c.dias} días
                        </span>
                        <span className="tabular ml-3 shrink-0 font-semibold text-danger-ink">
                          {money(Number(c.owed))}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

/* Estilos compartidos de ejes/tooltip: grilla recesiva, tipografía 11px.
   Sin doble eje jamás: lo que comparte unidad comparte escala. */
const EJE = {
  tick: { fill: "var(--muted-foreground)", fontSize: 11 },
  tickLine: false,
} as const;
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

/** Tendencia → área con línea (la forma la elige el trabajo del dato). */
function AreaTrend({ data }: { data: { name: string; Facturación: number }[] }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
          <defs>
            <linearGradient id="gVentas" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.18} />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="name" {...EJE} axisLine={{ stroke: "var(--border)" }} />
          <YAxis {...EJE} axisLine={false} tickFormatter={kFmt} />
          <Tooltip {...TOOLTIP} formatter={(v, name) => [money(Number(v ?? 0)), String(name)]} />
          <Area
            type="monotone"
            dataKey="Facturación"
            stroke="var(--primary)"
            strokeWidth={2}
            fill="url(#gVentas)"
            dot={false}
            activeDot={{ r: 4, fill: "var(--primary-ink)", stroke: "var(--card)" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Comparación de días: barras, pero el día fuerte grita y el resto acompaña. */
function DiasChart({ data }: { data: { name: string; Promedio: number }[] }) {
  const max = Math.max(...data.map((d) => d.Promedio), 0);
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="name" {...EJE} axisLine={{ stroke: "var(--border)" }} />
          <YAxis {...EJE} axisLine={false} tickFormatter={kFmt} />
          <Tooltip {...TOOLTIP} formatter={(v) => [money(Number(v ?? 0)), "Promedio"]} />
          <Bar dataKey="Promedio" radius={[4, 4, 0, 0]} maxBarSize={38}>
            {data.map((d) => (
              <Cell
                key={d.name}
                fill="var(--primary)"
                fillOpacity={d.Promedio === max && max > 0 ? 1 : 0.35}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Franjas horarias como DONUT (pedido del owner: que no sea todo líneas y
    barras): proporción del total, con la franja fuerte destacada y la
    leyenda con % y montos al lado. */
const SLOT_COLORS = ["#6d9bff", "#2e6bff", "#4a5b78", "#93a5c0"];
function SlotDonut({ slots }: { slots: { orden: number; name: string; total: number }[] }) {
  const total = slots.reduce((a, s) => a + Number(s.total), 0);
  if (total === 0) return <Vacio>Sin ventas en este período.</Vacio>;
  const datos = slots
    .filter((s) => Number(s.total) > 0)
    .map((s, i) => ({ name: s.name, value: Number(s.total), fill: SLOT_COLORS[i % SLOT_COLORS.length] }));
  const fuerte = datos.reduce((a, b) => (b.value > a.value ? b : a), datos[0]);
  return (
    <div className="flex h-full min-h-44 items-center gap-5">
      <div className="relative h-44 w-44 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip {...TOOLTIP} formatter={(v, name) => [money(Number(v ?? 0)), String(name)]} />
            <Pie
              data={datos}
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
                <Cell key={d.name} fill={d.fill} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        {/* centro: la franja fuerte, el dato que importa */}
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="tabular text-xl font-bold leading-none">
              {Math.round((fuerte.value / total) * 100)}%
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{fuerte.name}</p>
          </div>
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-3">
        {datos.map((d) => (
          <li key={d.name} className="flex items-start gap-2.5 text-sm">
            <span
              aria-hidden
              className="mt-1.5 size-2.5 shrink-0 rounded-sm"
              style={{ background: d.fill }}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-muted-foreground">{d.name}</span>
                <span className="tabular font-semibold">
                  {Math.round((d.value / total) * 100)}%
                </span>
              </div>
              <p className="tabular text-xs text-muted-foreground">{money(d.value)}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Barras anidadas: el total es la facturación; el relleno verde, la ganancia
    que quedó ADENTRO de eso. Cuenta la historia completa en una sola barra. */
function CategoriasAnidadas({
  cats,
}: {
  cats: { name: string; color: string | null; revenue: number; profit: number }[];
}) {
  const orden = [...cats].sort((a, b) => Number(b.revenue) - Number(a.revenue));
  const max = Math.max(...orden.map((c) => Number(c.revenue)), 1);
  return (
    <ul className="space-y-3.5">
      {orden.map((c) => {
        const rev = Number(c.revenue);
        const prof = Math.max(Number(c.profit), 0);
        const wRev = (rev / max) * 100;
        const wProf = rev > 0 ? (prof / rev) * 100 : 0;
        return (
          <li key={c.name}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate font-medium">{c.name}</span>
              <span className="tabular shrink-0 text-xs text-muted-foreground">
                {money(rev)}
                {prof > 0 && (
                  <>
                    {" · "}
                    <span className="font-semibold text-success-ink">{money(prof)}</span>
                  </>
                )}
              </span>
            </div>
            <div className="h-3 rounded-full bg-secondary/50">
              <div
                className="relative h-full rounded-full bg-primary/35"
                style={{ width: `${wRev}%` }}
              >
                {wProf > 0 && (
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-success"
                    style={{ width: `${wProf}%` }}
                  />
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Fiaste vs. cobraste, pareadas: el hueco entre las dos ES el mensaje. */
function FiadoPareado({ given, collected }: { given: number; collected: number }) {
  const max = Math.max(given, collected, 1);
  const filas = [
    { label: "Fiaste", valor: given, color: "#e3b378", texto: "" },
    { label: "Cobraste", valor: collected, color: "var(--success)", texto: "text-success-ink" },
  ];
  return (
    <ul className="space-y-3">
      {filas.map((f) => (
        <li key={f.label} className="flex items-center gap-3">
          <span className="w-16 shrink-0 text-sm text-muted-foreground">{f.label}</span>
          <div className="h-3 flex-1 rounded-full bg-secondary/50">
            <div
              className="h-full rounded-full"
              style={{ width: `${(f.valor / max) * 100}%`, background: f.color }}
            />
          </div>
          <span className={cn("tabular w-24 shrink-0 text-right text-sm font-semibold", f.texto)}>
            {money(f.valor)}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Sparkline del hero: la tendencia del período en 40px, sin ejes. */
function Spark({ data }: { data: { fecha: string; total: number }[] }) {
  return (
    <div className="mt-2.5 h-10 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data.map((d) => ({ v: Number(d.total) }))}
          margin={{ top: 2, right: 0, bottom: 0, left: 0 }}
        >
          <defs>
            <linearGradient id="gSpark" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.22} />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke="var(--primary)"
            strokeWidth={1.5}
            fill="url(#gSpark)"
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function Comparacion({
  pct,
  unidadesAhora,
  unidadesAntes,
}: {
  pct: number | null;
  unidadesAhora: number;
  unidadesAntes: number;
}) {
  if (pct === null) {
    return <span className="text-xs text-muted-foreground">Sin período anterior para comparar</span>;
  }
  const sube = pct > 0;
  const unidPct =
    unidadesAntes > 0
      ? Math.round(((Number(unidadesAhora) - Number(unidadesAntes)) / Number(unidadesAntes)) * 100)
      : null;

  return (
    <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs">
      <span
        className={cn(
          "flex items-center gap-1 font-medium",
          pct === 0 ? "text-muted-foreground" : sube ? "text-success-ink" : "text-danger-ink",
        )}
      >
        {pct === 0 ? (
          <Minus className="size-3" />
        ) : sube ? (
          <TrendingUp className="size-3" />
        ) : (
          <TrendingDown className="size-3" />
        )}
        {signedPct(pct)}
      </span>
      <span className="text-muted-foreground">
        vs. período anterior
        {/* Las unidades no mienten con inflación: son el contrapunto honesto. */}
        {unidPct !== null && ` · ${signedPct(unidPct)} en cantidad`}
      </span>
    </span>
  );
}

/** Métrica dormida: dice qué falta y cuánto, nunca un 0% ni una flecha roja. */
function Dormida({ faltan, que }: { faltan: number; que: string }) {
  return (
    <span className="flex items-start gap-1.5 text-xs text-muted-foreground">
      <Lock className="mt-0.5 size-3 shrink-0" />
      Faltan {faltan} {faltan === 1 ? "día" : "días"} de uso para {que}.
    </span>
  );
}

function Metric({
  label,
  valor,
  tono,
  children,
}: {
  label: string;
  valor: string;
  tono?: "success";
  children?: React.ReactNode;
}) {
  return (
    <Card className="p-4 lg:p-4">
      <h2 className="text-sm font-medium text-muted-foreground">{label}</h2>
      <p
        className={cn(
          "tabular mt-1 text-2xl font-semibold",
          tono === "success" && "text-success-ink",
        )}
      >
        {valor}
      </p>
      <div className="mt-1.5">{children}</div>
    </Card>
  );
}

function Panel({
  title,
  subtitle,
  icon: Icon,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <div className="mb-3">
        <h2 className="flex items-center gap-1.5 text-sm font-medium">
          {Icon && <Icon className="size-4 text-muted-foreground" />}
          {title}
        </h2>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </Card>
  );
}

function Ranking({
  items,
}: {
  items: {
    id: string;
    emoji: string | null;
    name: string;
    principal: string;
    secundario: string;
    tono?: "success" | "danger";
  }[];
}) {
  return (
    <ul className="divide-y divide-border">
      {items.map((it, i) => (
        <li key={it.id} className="flex items-center gap-3 py-2.5">
          <span className="tabular w-4 shrink-0 text-xs text-muted-foreground">{i + 1}</span>
          <span className="text-lg" aria-hidden>
            {it.emoji ?? "📦"}
          </span>
          <p className="min-w-0 flex-1 truncate text-sm font-medium">{it.name}</p>
          <div className="shrink-0 text-right">
            <p
              className={cn(
                "tabular text-sm font-semibold",
                it.tono === "success" && "text-success-ink",
                it.tono === "danger" && "text-danger-ink",
              )}
            >
              {it.principal}
            </p>
            <p className="tabular text-xs text-muted-foreground">{it.secundario}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function Vacio({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>;
}
