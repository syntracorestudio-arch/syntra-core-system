"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Banknote,
  QrCode,
  CreditCard,
  ArrowRightLeft,
  ChevronLeft,
  ChevronRight,
  Ban,
  X,
  LoaderCircle,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Card, CardHero } from "@/components/ui/card-system";
import { AvisoBanner } from "@/components/ui/aviso";
import { PageHeader } from "@/components/ui/page-header";
import { money } from "@/lib/format";
import { anularVenta } from "./actions";

export type CierreData = {
  fecha: string;
  facturado: number;
  entro_en_caja: number;
  fiado: number;
  cobros_fiado: number;
  efectivo_esperado: number;
  anuladas: number;
  by_method: { method: string; total: number; count: number }[];
  ventas: {
    id: string;
    total: number;
    payment_method: string;
    status: string;
    sold_at: string;
    vendedor: string | null;
    cliente: string | null;
    items: number;
    detalle: string | null;
  }[];
};

const MEDIOS: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  cash: { label: "Efectivo", icon: Banknote },
  qr: { label: "QR", icon: QrCode },
  card: { label: "Tarjeta", icon: CreditCard },
  transfer: { label: "Transferencia", icon: ArrowRightLeft },
  account: { label: "Fiado", icon: Wallet },
};

export function CajaClient({
  data,
  puedeAnular,
  timezone,
}: {
  data: CierreData | null;
  puedeAnular: boolean;
  /* La hora se muestra en la zona DEL NEGOCIO, igual que el corte del día en la
     RPC. Si dependiera del navegador, una venta de las 21:40 se leería a otra
     hora desde un teléfono con la zona mal puesta y no cerraría con el listado. */
  timezone: string;
}) {
  const router = useRouter();
  const [anulando, setAnulando] = useState<CierreData["ventas"][number] | null>(null);
  const [contado, setContado] = useState("");
  const [aviso, setAviso] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  if (!data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 lg:px-8">
        <p className="text-sm text-muted-foreground">No pudimos cargar la caja.</p>
      </div>
    );
  }

  const hoy = new Date().toISOString().slice(0, 10);
  const esHoy = data.fecha === hoy;

  function irA(dias: number) {
    const d = new Date(`${data!.fecha}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + dias);
    router.push(`/admin/caja?d=${d.toISOString().slice(0, 10)}`);
  }

  const diferencia = contado === "" ? null : Number(contado) - Number(data.efectivo_esperado);

  const fechaLarga = new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${data.fecha}T12:00:00Z`));

  // 24h: así se lee un turno de kiosco ("21:40"), y no rompe el ancho de columna.
  const horaFmt = new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: timezone,
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 lg:px-8 lg:py-8">
      <div className="mb-5">
        <PageHeader
          title="Caja"
          subtitle={fechaLarga.charAt(0).toUpperCase() + fechaLarga.slice(1)}
          icon={Wallet}
        >
          <button
            type="button"
            onClick={() => irA(-1)}
            aria-label="Día anterior"
            className="grid size-9 cursor-pointer place-items-center rounded-lg border border-border bg-background/60 text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            disabled={esHoy}
            onClick={() => irA(1)}
            aria-label="Día siguiente"
            className="grid size-9 cursor-pointer place-items-center rounded-lg border border-border bg-background/60 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
          >
            <ChevronRight className="size-4" />
          </button>
        </PageHeader>
      </div>

      <AvisoBanner aviso={aviso} onClose={() => setAviso(null)} />

      {/* Lo que el kiosquero necesita saber para cerrar */}
      <CardHero glow="success">
        <h2 className="text-sm font-medium text-muted-foreground">Entró en caja</h2>
        <p className="tabular text-3xl font-semibold text-success-ink lg:text-4xl">
          {money(Number(data.entro_en_caja))}
        </p>
        <dl className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Vendiste (facturado)</dt>
            <dd className="tabular">{money(Number(data.facturado))}</dd>
          </div>
          {Number(data.fiado) > 0 && (
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Fiaste (no entró)</dt>
              <dd className="tabular text-warning-ink">−{money(Number(data.fiado))}</dd>
            </div>
          )}
          {Number(data.cobros_fiado) > 0 && (
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Cobraste de fiado</dt>
              <dd className="tabular text-success-ink">+{money(Number(data.cobros_fiado))}</dd>
            </div>
          )}
        </dl>
      </CardHero>

      {data.by_method.length > 0 && (
        <Card className="mt-4">
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">Cómo te pagaron</h2>
          <ul className="space-y-2">
            {data.by_method.map((m) => {
              const meta = MEDIOS[m.method] ?? { label: m.method, icon: Banknote };
              return (
                <li key={m.method} className="flex items-center gap-3">
                  <meta.icon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1 text-sm">{meta.label}</span>
                  <span className="tabular text-xs text-muted-foreground">{m.count}</span>
                  <span className="tabular w-24 text-right text-sm font-semibold">
                    {money(Number(m.total))}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {/* Conteo del cajón: la razón de ser del cierre */}
      <Card className="mt-4">
        <h2 className="text-sm font-medium">Contá el efectivo</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Deberías tener{" "}
          <span className="tabular font-semibold text-foreground">
            {money(Number(data.efectivo_esperado))}
          </span>{" "}
          en el cajón.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <input
            value={contado}
            onChange={(e) => setContado(e.target.value.replace(/[^\d]/g, ""))}
            inputMode="numeric"
            placeholder="¿Cuánto contaste?"
            aria-label="Efectivo contado"
            className="tabular h-11 w-44 rounded-lg border border-input bg-background px-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
          />
          {diferencia !== null && (
            <span
              className={cn(
                "text-sm font-medium",
                diferencia === 0 && "text-success-ink",
                diferencia > 0 && "text-warning-ink",
                diferencia < 0 && "text-danger-ink",
              )}
            >
              {diferencia === 0
                ? "Justo"
                : diferencia > 0
                  ? `Sobran ${money(diferencia)}`
                  : `Faltan ${money(-diferencia)}`}
            </span>
          )}
        </div>
      </Card>

      {/* Detalle para revisar y corregir */}
      <h2 className="mb-2 mt-6 flex items-center justify-between text-sm font-medium text-muted-foreground">
        <span>Ventas del día ({data.ventas.length})</span>
        {data.anuladas > 0 && (
          <span className="text-xs">
            {data.anuladas} anulada{data.anuladas === 1 ? "" : "s"}
          </span>
        )}
      </h2>

      {data.ventas.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
          No hubo ventas este día.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-[#0e1219]">
          {data.ventas.map((v) => {
            const anulada = v.status === "voided";
            const meta = MEDIOS[v.payment_method] ?? { label: v.payment_method, icon: Banknote };
            const hora = horaFmt.format(new Date(v.sold_at));
            return (
              <li key={v.id} className={cn("flex items-center gap-3 px-4 py-3", anulada && "opacity-50")}>
                <span className="tabular w-11 shrink-0 text-xs text-muted-foreground">{hora}</span>
                <div className="min-w-0 flex-1">
                  <p className={cn("truncate text-sm font-medium", anulada && "line-through")}>
                    {v.detalle ?? `${v.items} productos`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {meta.label}
                    {v.cliente && ` · ${v.cliente}`}
                    {v.vendedor && ` · ${v.vendedor}`}
                    {anulada && " · ANULADA"}
                  </p>
                </div>
                <span className={cn("tabular shrink-0 text-sm font-semibold", anulada && "line-through")}>
                  {money(Number(v.total))}
                </span>
                {puedeAnular && !anulada && (
                  <button
                    type="button"
                    onClick={() => setAnulando(v)}
                    aria-label="Anular esta venta"
                    className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-md border border-border text-muted-foreground transition-colors hover:border-danger hover:text-danger-ink"
                  >
                    <Ban className="size-3.5" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {anulando && (
        <AnularDialog
          venta={anulando}
          onClose={() => setAnulando(null)}
          onDone={() => {
            setAnulando(null);
            setAviso({
              tone: "ok",
              text: "Venta anulada. Se devolvió el stock y, si era fiada, la deuda.",
            });
          }}
          onError={(e) => setAviso({ tone: "error", text: e })}
        />
      )}
    </div>
  );
}

function AnularDialog({
  venta,
  onClose,
  onDone,
  onError,
}: {
  venta: CierreData["ventas"][number];
  onClose: () => void;
  onDone: () => void;
  onError: (msg: string) => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <div className="fixed inset-0 z-50 grid place-items-end overflow-y-auto bg-black/60 sm:place-items-center sm:p-4">
      <div className="w-full rounded-t-2xl border border-border bg-popover p-5 sm:max-w-sm sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Anular esta venta</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="cursor-pointer text-muted-foreground hover:text-foreground">
            <X className="size-5" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="rounded-lg border border-border bg-background p-3">
            <p className="text-sm font-medium">{venta.detalle ?? `${venta.items} productos`}</p>
            <p className="tabular mt-0.5 text-lg font-semibold">{money(Number(venta.total))}</p>
          </div>

          {/* Decir qué va a pasar antes de que pase: anular mueve stock y deuda. */}
          <p className="text-sm text-muted-foreground">
            El stock vuelve a la góndola
            {venta.payment_method === "account" && " y se le saca la deuda al cliente"}. La venta
            queda registrada como anulada, no se borra.
          </p>

          <div className="space-y-1.5">
            <label htmlFor="an-motivo" className="text-sm font-medium">
              ¿Por qué la anulás?
            </label>
            <input
              id="an-motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              autoFocus
              placeholder="Se equivocó de producto"
              className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary"
            />
          </div>

          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const res = await anularVenta(venta.id, motivo);
                if (!res.ok) {
                  onError(res.error);
                  return;
                }
                onDone();
              })
            }
            className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-danger text-sm font-semibold text-danger-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {pending && <LoaderCircle className="size-4 animate-spin" />}
            Anular la venta
          </button>
        </div>
      </div>
    </div>
  );
}
