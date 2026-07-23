import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Clock,
  Wallet,
  Banknote,
  QrCode,
  CreditCard,
  ArrowRightLeft,
  UserRound,
  ChevronRight,
  ShoppingBasket,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { money, signedPct } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";

export type DashboardData = {
  today: {
    total: number;          // facturado
    cash_in: number;        // lo que ENTRÓ (ventas cobradas + cobros de fiado)
    credit_given: number;   // lo que fiaste hoy
    credit_collected: number;
    count: number;
    profit: number;
    profit_coverage: number | null;
    avg_previous: number;
    vs_avg_pct: number | null;
  };
  by_method: { method: string; total: number; count: number }[];
  restock: {
    product_id: string;
    name: string;
    emoji: string | null;
    stock: number;
    vendidas_7d: number;
    dias_restantes: number | null;
  }[];
  credit: {
    total: number;
    top: { client_id: string; name: string; owed: number; credit_limit: number | null }[];
  };
  low_stock: { product_id: string; name: string; emoji: string | null; stock: number }[];
  expiring: { expiry_id: string; name: string; emoji: string | null; days_left: number }[];
};

const MEDIOS: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  cash: { label: "Efectivo", icon: Banknote },
  qr: { label: "QR", icon: QrCode },
  card: { label: "Tarjeta", icon: CreditCard },
  transfer: { label: "Transfer.", icon: ArrowRightLeft },
  account: { label: "Fiado", icon: UserRound },
};

export function DashboardClient({
  data,
  timezone,
}: {
  data: DashboardData | null;
  timezone: string;
}) {
  if (!data) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 lg:px-8">
        <p className="text-sm text-muted-foreground">No pudimos cargar el resumen.</p>
      </div>
    );
  }

  const { today, by_method, restock, credit, low_stock, expiring } = data;
  const totalMedios = by_method.reduce((a, m) => a + Number(m.total), 0);
  const sinVentas = today.count === 0;

  const fecha = new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: timezone,
  }).format(new Date());

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8 lg:py-8">
      <div className="mb-6">
        {/* `first-letter` en el subtítulo lo maneja PageHeader vía el string ya
            formateado: acá capitalizamos a mano la primera letra de la fecha
            ("miércoles" → "Miércoles") en vez de `capitalize`, que pondría
            mayúscula en CADA palabra y dejaría "22 De Julio". */}
        <PageHeader
          title="Hoy"
          subtitle={fecha.charAt(0).toUpperCase() + fecha.slice(1)}
          icon={ShoppingBasket}
        />
      </div>

      {/* Fila 1 — los dos números que importan */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardLabel>Vendido hoy</CardLabel>
          <p className="tabular text-3xl font-semibold lg:text-4xl">{money(today.total)}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            {sinVentas ? (
              <span className="text-muted-foreground">Todavía no vendiste nada hoy.</span>
            ) : (
              <>
                <Tendencia pct={today.vs_avg_pct} />
                <span className="text-muted-foreground">
                  {today.vs_avg_pct !== null && "vs. tu promedio · "}
                  {today.count} {today.count === 1 ? "venta" : "ventas"}
                </span>
              </>
            )}
          </div>

          {/* Facturado NO es lo que entró: fiar es vender sin cobrar. Separarlo
              es la diferencia entre un número creíble y uno que miente. */}
          {(today.credit_given > 0 || today.credit_collected > 0) && (
            <dl className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Entró en caja</dt>
                <dd className="tabular font-semibold text-success-ink">
                  {money(today.cash_in)}
                </dd>
              </div>
              {today.credit_given > 0 && (
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Fiaste</dt>
                  <dd className="tabular font-medium text-warning-ink">
                    {money(today.credit_given)}
                  </dd>
                </div>
              )}
              {today.credit_collected > 0 && (
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Cobraste de fiado</dt>
                  <dd className="tabular font-medium">{money(today.credit_collected)}</dd>
                </div>
              )}
            </dl>
          )}
        </Card>

        <Card>
          <CardLabel>Ganancia estimada</CardLabel>
          {/* Degradar con honestidad: si faltan costos, el número miente y hay que
              decirlo en vez de mostrarlo como si fuera exacto. */}
          {today.profit_coverage === null ? (
            <>
              <p className="tabular text-3xl font-semibold text-muted-foreground lg:text-4xl">
                —
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Cargá el costo de tus productos y te decimos cuánto ganás.
              </p>
            </>
          ) : (
            <>
              <p className="tabular text-3xl font-semibold text-success-ink lg:text-4xl">
                {money(today.profit)}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {today.profit_coverage >= 90 ? (
                  <>Sobre lo que pagaste vos</>
                ) : (
                  <span className="text-warning-ink">
                    Solo {today.profit_coverage}% de lo vendido tiene costo cargado — el número
                    real es mayor.
                  </span>
                )}
              </p>
            </>
          )}
        </Card>
      </div>

      {/* Fila 2 — cómo te pagaron */}
      {by_method.length > 0 && (
        <Card className="mt-4">
          <CardLabel>Cómo te pagaron</CardLabel>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {by_method.map((m) => {
              const meta = MEDIOS[m.method] ?? { label: m.method, icon: Banknote };
              const pct = totalMedios > 0 ? Math.round((Number(m.total) / totalMedios) * 100) : 0;
              return (
                <div key={m.method}>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <meta.icon className="size-3.5" />
                    {meta.label}
                  </div>
                  <p className="tabular mt-1 font-semibold">{money(Number(m.total))}</p>
                  <div className="mt-1.5 h-1 rounded-full bg-secondary">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Fila 3 — lo que requiere acción */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between">
            <CardLabel>
              <AlertTriangle className="size-4 text-warning-ink" />
              Te estás quedando sin
            </CardLabel>
            {low_stock.length > 0 && <Badge tone="warning">{low_stock.length}</Badge>}
          </div>
          {low_stock.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Todo con stock suficiente.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {low_stock.slice(0, 4).map((p) => (
                <li key={p.product_id} className="flex items-center gap-3 py-2.5">
                  <span className="text-lg" aria-hidden>
                    {p.emoji ?? "📦"}
                  </span>
                  <p className="min-w-0 flex-1 truncate text-sm font-medium">{p.name}</p>
                  <span className="tabular shrink-0 text-sm font-semibold text-warning-ink">
                    quedan {Number(p.stock)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {low_stock.length > 0 && (
            <VerTodo href="/admin/productos">Ver productos</VerTodo>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <CardLabel>
              <Clock className="size-4 text-danger-ink" />
              Vence pronto
            </CardLabel>
            {expiring.length > 0 && <Badge tone="danger">{expiring.length}</Badge>}
          </div>
          {expiring.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Nada por vencer.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {expiring.slice(0, 4).map((e) => (
                <li key={e.expiry_id} className="flex items-center gap-3 py-2.5">
                  <span className="text-lg" aria-hidden>
                    {e.emoji ?? "📦"}
                  </span>
                  <p className="min-w-0 flex-1 truncate text-sm font-medium">{e.name}</p>
                  <span className="tabular shrink-0 text-sm font-semibold text-danger-ink">
                    {e.days_left <= 0
                      ? "vencido"
                      : e.days_left === 1
                        ? "mañana"
                        : `en ${e.days_left} días`}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {expiring.length > 0 && <VerTodo href="/admin/vencimientos">Ver vencimientos</VerTodo>}
        </Card>
      </div>

      {/* Fila 4 — fiado y top */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between">
            <CardLabel>
              <Wallet className="size-4" />
              Fiado en la calle
            </CardLabel>
            <Link
              href="/admin/fiado"
              className="flex items-center gap-0.5 text-xs text-primary-ink hover:underline"
            >
              Ver todo <ChevronRight className="size-3.5" />
            </Link>
          </div>
          {credit.total === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Nadie te debe nada.</p>
          ) : (
            <>
              <p className="tabular mt-2 text-2xl font-semibold">{money(Number(credit.total))}</p>
              <ul className="mt-3 divide-y divide-border">
                {credit.top.map((c) => {
                  const pasado =
                    c.credit_limit !== null && Number(c.owed) > Number(c.credit_limit);
                  return (
                    <li key={c.client_id}>
                      <Link
                        href={`/admin/fiado/${c.client_id}`}
                        className="flex items-center justify-between py-2.5 transition-colors hover:text-primary-ink"
                      >
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">
                          {c.name}
                          {pasado && (
                            <span className="ml-1.5 text-xs text-danger-ink">pasó su límite</span>
                          )}
                        </span>
                        <span className="tabular shrink-0 text-sm font-semibold">
                          {money(Number(c.owed))}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </Card>

        {/* Reemplaza al viejo "top de la semana", que era tendencia y se mudó a
            Reportes. La decisión de la mañana no es "qué está bajo" sino "qué se
            me acaba primero": por eso ordena por ritmo de venta, no alfabético. */}
        <Card>
          <CardLabel>
            <ShoppingBasket className="size-4" />
            Para reponer
          </CardLabel>
          {restock.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              No hay nada urgente para reponer.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {restock.slice(0, 5).map((p) => (
                <li key={p.product_id} className="flex items-center gap-3 py-2.5">
                  <span className="text-lg" aria-hidden>
                    {p.emoji ?? "📦"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <p className="tabular text-xs text-muted-foreground">
                      {Number(p.vendidas_7d) > 0
                        ? `se vende ${(Number(p.vendidas_7d) / 7).toFixed(1)} por día`
                        : "sin ventas esta semana"}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="tabular text-sm font-semibold">{Number(p.stock)}u</p>
                    {p.dias_restantes !== null && (
                      <p
                        className={cn(
                          "tabular text-xs",
                          Number(p.dias_restantes) <= 2 ? "text-danger-ink" : "text-warning-ink",
                        )}
                      >
                        {Number(p.dias_restantes) < 1
                          ? "menos de un día"
                          : `~${Number(p.dias_restantes)} días`}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {sinVentas && (
        <p className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <ShoppingBasket className="size-4" />
          <Link href="/pos" className="text-primary-ink hover:underline">
            Abrir la caja
          </Link>
        </p>
      )}
    </div>
  );
}

/** Tendencia con ícono + signo: el color nunca informa solo. */
function Tendencia({ pct }: { pct: number | null }) {
  if (pct === null) {
    return <span className="text-muted-foreground">Primer día con ventas</span>;
  }
  if (pct === 0) {
    return (
      <span className="flex items-center gap-1 text-muted-foreground">
        <Minus className="size-4" /> igual que tu promedio
      </span>
    );
  }
  const sube = pct > 0;
  return (
    <span
      className={cn(
        "flex items-center gap-1",
        sube ? "text-success-ink" : "text-danger-ink",
      )}
    >
      {sube ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
      {signedPct(pct)}
    </span>
  );
}

function VerTodo({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="mt-3 flex items-center gap-0.5 text-xs text-primary-ink hover:underline"
    >
      {children} <ChevronRight className="size-3.5" />
    </Link>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-border bg-card p-4 lg:p-5 ${className}`}>
      {children}
    </section>
  );
}

function CardLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
      {children}
    </h2>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone: "warning" | "danger" }) {
  const tones = {
    warning: "bg-warning/15 text-warning-ink ring-warning/30",
    danger: "bg-danger/15 text-danger-ink ring-danger/30",
  };
  return (
    <span className={`tabular rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${tones[tone]}`}>
      {children}
    </span>
  );
}
