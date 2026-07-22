"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
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
} from "lucide-react";
import { cn } from "@/lib/cn";
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
      <div className="mx-auto max-w-5xl px-4 py-10 lg:px-8">
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
    <div className="mx-auto max-w-5xl px-4 py-6 lg:px-8 lg:py-8">
      <header className="mb-4">
        <h1 className="text-xl font-semibold tracking-tight lg:text-2xl">Cómo viene el negocio</h1>
        <p className="text-sm text-muted-foreground">{rangoTexto}</p>
      </header>

      {/* Selector: chips de nivel + flechas dentro del nivel. Sin dropdown de 12
          meses ni fechas tipeadas en el teléfono. */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-border p-0.5">
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
                  "cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  periodo === key
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground",
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
            className="grid size-9 cursor-pointer place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            disabled={offset >= 0}
            onClick={() => ir(periodo, offset + 1)}
            aria-label="Período siguiente"
            className="grid size-9 cursor-pointer place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
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
          <p className="text-sm font-medium">No hay ventas en este período</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Probá con otro período o empezá a vender desde la caja.
          </p>
        </div>
      ) : (
        <>
          {/* ---------------- A. La plata ---------------- */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Vendiste" valor={money(m.sold)}>
              {dias >= UMBRALES.comparacion ? (
                <Comparacion pct={m.vs_prev_pct} unidadesAhora={m.units} unidadesAntes={m.prev_units} />
              ) : (
                <Dormida faltan={UMBRALES.comparacion - dias} que="comparar con el período anterior" />
              )}
            </Metric>

            <Metric
              label="Ganancia sobre la mercadería"
              valor={m.margin_pct === null ? "—" : money(m.profit)}
              tono="success"
            >
              <span className="text-xs text-muted-foreground">
                {m.margin_pct === null
                  ? "Cargá costos para verla"
                  : `Margen ${m.margin_pct}% · no incluye alquiler ni servicios`}
              </span>
            </Metric>

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

          {/* Evolución */}
          <Panel title="Cómo se movió" className="mt-4">
            <Chart
              data={data.by_date.map((d) => ({
                name: periodo === "anio" ? d.fecha.slice(5) : d.fecha.slice(8),
                Facturación: Number(d.total),
              }))}
              series={[{ key: "Facturación", color: "var(--chart-1)" }]}
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
            <Panel title="Por categoría" className="mt-4">
              <Chart
                data={data.by_category.map((c) => ({
                  name: c.name,
                  Facturación: Number(c.revenue),
                  Ganancia: Number(c.profit),
                }))}
                series={[
                  { key: "Facturación", color: "var(--chart-1)" },
                  { key: "Ganancia", color: "var(--chart-2)" },
                ]}
              />
            </Panel>
          )}

          {/* ---------------- C. Cuándo vendés ---------------- */}
          {dias >= UMBRALES.ritmos ? (
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <Panel title="Qué días vendés más">
                <Chart
                  data={data.by_weekday.map((d) => ({
                    name: DIAS[d.dow],
                    Promedio: d.dias > 0 ? Math.round(Number(d.total) / d.dias) : 0,
                  }))}
                  series={[{ key: "Promedio", color: "var(--chart-1)" }]}
                />
              </Panel>
              <Panel title="A qué hora vendés">
                <Chart
                  data={data.by_slot.map((f) => ({
                    name: f.name,
                    Facturación: Number(f.total),
                  }))}
                  series={[{ key: "Facturación", color: "var(--chart-1)" }]}
                />
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

          <Panel title="Fiado del período" icon={Wallet} className="mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Fiaste</p>
                <p className="tabular text-xl font-semibold">{money(Number(data.credit.given))}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Cobraste</p>
                <p className="tabular text-xl font-semibold text-success-ink">
                  {money(Number(data.credit.collected))}
                </p>
              </div>
            </div>
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

/**
 * Barras. Marcas finas, punta redondeada, grilla recesiva y tooltip siempre
 * (un gráfico en HTML es interactivo por definición). Sin doble eje jamás:
 * facturación y ganancia comparten unidad, así que comparten escala.
 */
function Chart({
  data,
  series,
}: {
  data: Record<string, string | number>[];
  series: { key: string; color: string }[];
}) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
          />
          <YAxis
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
          />
          <Tooltip
            cursor={{ fill: "var(--secondary)", opacity: 0.4 }}
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: "0.5rem",
              fontSize: "0.8rem",
            }}
            labelStyle={{ color: "var(--foreground)" }}
            formatter={(v, name) => [money(Number(v ?? 0)), String(name)]}
          />
          {/* Leyenda solo con 2+ series: con una, el título ya la nombra. */}
          {series.length > 1 && (
            <Legend wrapperStyle={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }} />
          )}
          {series.map((s) => (
            <Bar key={s.key} dataKey={s.key} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={38} />
          ))}
        </BarChart>
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
    <section className="rounded-xl border border-border bg-card p-4">
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
    </section>
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
    <section className={`rounded-xl border border-border bg-card p-4 lg:p-5 ${className}`}>
      <div className="mb-3">
        <h2 className="flex items-center gap-1.5 text-sm font-medium">
          {Icon && <Icon className="size-4 text-muted-foreground" />}
          {title}
        </h2>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </section>
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
