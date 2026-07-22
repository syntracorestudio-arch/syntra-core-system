import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Clock,
  Wallet,
  Banknote,
  QrCode,
  CreditCard,
  ArrowRightLeft,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/shell/app-shell";
import { money, signedPct } from "@/lib/format";
import { requireOwner } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Dashboard del dueño — "tu negocio en una pantalla".
 *
 * TANDA 1A: los datos son un fixture local para poder juzgar la dirección visual.
 * En la tanda 1H se reemplazan por queries reales, TODAS con cota de fecha
 * (`syntra-scale-security-baseline`). El fixture vive acá a propósito: cuando llegue
 * 1H se borra este bloque entero y no queda mock suelto en el árbol.
 */
const DEMO = {
  vendidoHoy: 187_400,
  ventasHoy: 63,
  vsPromedio: 12,
  gananciaHoy: 54_300,
  margenPct: 29,
  medios: [
    { key: "efectivo", label: "Efectivo", monto: 98_200, icon: Banknote },
    { key: "qr", label: "QR", monto: 61_700, icon: QrCode },
    { key: "tarjeta", label: "Tarjeta", monto: 19_500, icon: CreditCard },
    { key: "transfer", label: "Transfer.", monto: 8_000, icon: ArrowRightLeft },
  ],
  stockBajo: [
    { nombre: "Coca-Cola 500ml", emoji: "🥤", quedan: 3, ritmo: "8 por día" },
    { nombre: "Marlboro box", emoji: "🚬", quedan: 2, ritmo: "6 por día" },
    { nombre: "Pan lactal", emoji: "🍞", quedan: 4, ritmo: "5 por día" },
  ],
  venceEn: [
    { nombre: "Yogur bebible", emoji: "🥛", dias: 2, cantidad: 6 },
    { nombre: "Jamón cocido", emoji: "🥓", dias: 5, cantidad: 1 },
  ],
  fiadoTotal: 84_600,
  fiadoTop: [
    { nombre: "Marta G.", saldo: 23_400, dias: 12 },
    { nombre: "Ruben P.", saldo: 18_900, dias: 5 },
    { nombre: "Ana L.", saldo: 12_100, dias: 3 },
  ],
  topSemana: [
    { nombre: "Coca-Cola 500ml", emoji: "🥤", unidades: 84, margen: 31 },
    { nombre: "Alfajor Jorgito", emoji: "🍫", unidades: 71, margen: 42 },
    { nombre: "Marlboro box", emoji: "🚬", unidades: 58, margen: 11 },
    { nombre: "Agua Villa 1.5L", emoji: "💧", unidades: 46, margen: 38 },
    { nombre: "Papas Lays", emoji: "🥔", unidades: 39, margen: 35 },
  ],
};

export default async function AdminDashboard() {
  const session = await requireOwner();
  const totalMedios = DEMO.medios.reduce((a, m) => a + m.monto, 0);
  const subiendo = DEMO.vsPromedio >= 0;

  return (
    <AppShell
      current="/admin"
      storeName={session.store.name}
      userLabel={`${session.member.display_name ?? "Vos"} · Dueño`}
    >
      <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8 lg:py-8">
        <header className="mb-6">
          <h1 className="text-xl font-semibold tracking-tight lg:text-2xl">Hoy</h1>
          <p className="text-sm text-muted-foreground">
            Domingo 21 de julio · abierto desde las 8:00
          </p>
        </header>

        {/* Fila 1 — los dos números que importan */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardLabel>Vendido hoy</CardLabel>
            <p className="tabular text-3xl font-semibold lg:text-4xl">
              {money(DEMO.vendidoHoy)}
            </p>
            <div className="mt-2 flex items-center gap-2 text-sm">
              {/* a11y: ícono + signo, el color solo refuerza */}
              <span
                className={
                  subiendo
                    ? "flex items-center gap-1 text-success-ink"
                    : "flex items-center gap-1 text-danger-ink"
                }
              >
                {subiendo ? (
                  <TrendingUp className="size-4" />
                ) : (
                  <TrendingDown className="size-4" />
                )}
                {signedPct(DEMO.vsPromedio)}
              </span>
              <span className="text-muted-foreground">
                vs. tu promedio · {DEMO.ventasHoy} ventas
              </span>
            </div>
          </Card>

          <Card>
            <CardLabel>Ganancia estimada</CardLabel>
            <p className="tabular text-3xl font-semibold text-success-ink lg:text-4xl">
              {money(DEMO.gananciaHoy)}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Margen promedio {DEMO.margenPct}% · sobre lo que pagaste vos
            </p>
          </Card>
        </div>

        {/* Fila 2 — cómo te pagaron */}
        <Card className="mt-4">
          <CardLabel>Cómo te pagaron</CardLabel>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {DEMO.medios.map((m) => (
              <div key={m.key}>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <m.icon className="size-3.5" />
                  {m.label}
                </div>
                <p className="tabular mt-1 font-semibold">{money(m.monto)}</p>
                <div
                  className="mt-1.5 h-1 rounded-full bg-primary/70"
                  style={{ width: `${Math.round((m.monto / totalMedios) * 100)}%` }}
                />
              </div>
            ))}
          </div>
        </Card>

        {/* Fila 3 — lo que requiere acción */}
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card>
            <div className="flex items-center justify-between">
              <CardLabel>
                <AlertTriangle className="size-4 text-warning-ink" />
                Te estás quedando sin
              </CardLabel>
              <Badge tone="warning">{DEMO.stockBajo.length}</Badge>
            </div>
            <ul className="mt-3 divide-y divide-border">
              {DEMO.stockBajo.map((p) => (
                <li key={p.nombre} className="flex items-center gap-3 py-2.5">
                  <span className="text-lg" aria-hidden>
                    {p.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.nombre}</p>
                    <p className="text-xs text-muted-foreground">Se vende {p.ritmo}</p>
                  </div>
                  <span className="tabular shrink-0 text-sm font-semibold text-warning-ink">
                    quedan {p.quedan}
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <CardLabel>
                <Clock className="size-4 text-danger-ink" />
                Vence pronto
              </CardLabel>
              <Badge tone="danger">{DEMO.venceEn.length}</Badge>
            </div>
            <ul className="mt-3 divide-y divide-border">
              {DEMO.venceEn.map((p) => (
                <li key={p.nombre} className="flex items-center gap-3 py-2.5">
                  <span className="text-lg" aria-hidden>
                    {p.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.nombre}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.cantidad} {p.cantidad === 1 ? "unidad" : "unidades"}
                    </p>
                  </div>
                  <span className="tabular shrink-0 text-sm font-semibold text-danger-ink">
                    en {p.dias} {p.dias === 1 ? "día" : "días"}
                  </span>
                </li>
              ))}
            </ul>
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
            <p className="tabular mt-2 text-2xl font-semibold">{money(DEMO.fiadoTotal)}</p>
            <ul className="mt-3 divide-y divide-border">
              {DEMO.fiadoTop.map((c) => (
                <li key={c.nombre} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-sm font-medium">{c.nombre}</p>
                    <p className="text-xs text-muted-foreground">
                      hace {c.dias} {c.dias === 1 ? "día" : "días"}
                    </p>
                  </div>
                  <span className="tabular text-sm font-semibold">{money(c.saldo)}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardLabel>Lo que más vendiste esta semana</CardLabel>
            <ul className="mt-3 divide-y divide-border">
              {DEMO.topSemana.map((p, i) => (
                <li key={p.nombre} className="flex items-center gap-3 py-2.5">
                  <span className="tabular w-4 text-xs text-muted-foreground">{i + 1}</span>
                  <span className="text-lg" aria-hidden>
                    {p.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.nombre}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="tabular text-sm font-semibold">{p.unidades}u</p>
                    <p className="tabular text-xs text-success-ink">{p.margen}% margen</p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

/* --- primitivos locales (se mudan a components/ui cuando entre shadcn en 1B) --- */

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
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

function Badge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "warning" | "danger";
}) {
  const tones = {
    warning: "bg-warning/15 text-warning-ink ring-warning/30",
    danger: "bg-danger/15 text-danger-ink ring-danger/30",
  };
  return (
    <span
      className={`tabular rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
