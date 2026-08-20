"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Banknote,
  QrCode,
  CreditCard,
  ArrowRightLeft,
  Ban,
  X,
  LoaderCircle,
  Wallet,
  Check,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Card, CardHero } from "@/components/ui/card-system";
import { AvisoBanner } from "@/components/ui/aviso";
import { PageHeader } from "@/components/ui/page-header";
import { DayPicker } from "@/components/ui/date-pickers";
import { money } from "@/lib/format";
import { MAX_LOOKBACK_DAYS, addDays, formatLongDate, formatShortDate, todayInTz } from "@/lib/date";
import { anularVenta } from "./actions";

/**
 * 052 · el cierre viene en DOS formas y `parcial` las distingue.
 *
 * No es un detalle de tipos: es el contrato del permiso. Un empleado con
 * `can_close_register` recibe `CierreTurno` —lo justo para contar el cajón— y
 * el dueño recibe `CierreCompleto`. El recorte lo hace `cierre_caja` en SQL;
 * acá sólo se refleja para que el compilador impida leer `facturado` cuando no
 * viajó. Antes de esto el tipo mentía: prometía plata que el payload del
 * empleado no trae.
 */
export type CierreTurno = {
  parcial: true;
  fecha: string;
  efectivo_esperado: number;
  ventas_del_turno: number;
  anuladas: number;
};

export type CierreCompleto = {
  parcial: false;
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

export type CierreData = CierreCompleto | CierreTurno;

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
  const [anulando, setAnulando] = useState<CierreCompleto["ventas"][number] | null>(null);
  const [contado, setContado] = useState("");
  const [aviso, setAviso] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  if (!data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 lg:px-8">
        <p className="text-sm text-muted-foreground">No pudimos cargar la caja.</p>
      </div>
    );
  }

  // "Hoy" en la zona DEL NEGOCIO, no la del server (UTC): si no, cerca de medianoche
  // ART el calendario dejaría elegir un día que para el kiosco todavía no llegó.
  const hoy = todayInTz(timezone);

  const diferencia = contado === "" ? null : Number(contado) - Number(data.efectivo_esperado);


  const fechaLarga = formatLongDate(data.fecha);

  /* 052 · el empleado que cierra su turno ve OTRA pantalla, no ésta con huecos.
     Contar el cajón es una sola tarea y merece una pantalla de una sola tarea:
     cuánto debería haber, cuánto hay, y la diferencia. Nada más. */
  if (data.parcial) {
    return (
      <CierreDeTurno
        data={data}
        contado={contado}
        setContado={setContado}
        diferencia={diferencia}
        fechaLarga={fechaLarga}
      />
    );
  }

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
          subtitle={fechaLarga}
          icon={Wallet}
          art="caja"
        >
          <DayPicker
            value={data.fecha}
            today={hoy}
            min={addDays(hoy, -MAX_LOOKBACK_DAYS)}
            onSelect={(d) => router.push(`/admin/caja?d=${d}`)}
            label={formatShortDate(data.fecha)}
          />
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
        <ul className="divide-y divide-border rounded-xl border border-border bg-surface-1">
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
  venta: CierreCompleto["ventas"][number];
  onClose: () => void;
  onDone: () => void;
  onError: (msg: string) => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/60 sm:place-items-center sm:p-4">
      <div className="max-h-[85dvh] w-full overflow-y-auto rounded-t-2xl border border-border bg-popover p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:max-w-sm sm:rounded-2xl">
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

/**
 * 052 · Cierre de turno — la pantalla del empleado.
 *
 * Deliberadamente NO es "la caja del dueño con cosas ocultas". Es la tarea del
 * que cierra: contar. Por eso el número grande es el efectivo esperado y no la
 * recaudación, y por eso no hay listado de ventas ni desglose por medio de
 * pago: sumarlos daría exactamente lo que el permiso no otorga.
 *
 * El recorte real lo hace `cierre_caja` en SQL — esto no oculta nada que haya
 * llegado al navegador, porque no llegó.
 */
/**
 * 052 · Cierre de turno — la pantalla del empleado.
 *
 * Deliberadamente NO es "la caja del dueño con cosas ocultas". Es la tarea del
 * que cierra: contar. Por eso el número grande es el efectivo esperado y no la
 * recaudación, y por eso no hay listado de ventas ni desglose por medio de
 * pago: sumarlos daría exactamente lo que el permiso no otorga.
 *
 * El recorte real lo hace `cierre_caja` en SQL — esto no oculta nada que haya
 * llegado al navegador, porque no llegó.
 *
 * COMPOSICIÓN. La primera versión era una columna de 512px: a 1920 sobraba el
 * 70% del ancho. No se estira a `max-w-6xl` —es UNA tarea, y estirarla la
 * empeora—: se ensancha a `max-w-4xl` y en ≥1024 se parte en contar | contexto.
 *
 * Se probó centrarla verticalmente para comerse el vacío de abajo y salió PEOR:
 * dejaba un hueco arriba y otro abajo, y el bloque quedaba flotando en el medio
 * como una isla. Una pantalla de una sola tarea arranca arriba, como todas las
 * demás; que abajo sobre lugar es honesto, son tres números.
 *
 * El `glow` del hero es el ESTADO DEL CONTEO y no decoración: apagado hasta que
 * hay un número, después verde si cierra justo, ámbar si sobra, rojo si falta.
 * Un solo momento con glow en la pantalla, y es el que importa.
 */
function CierreDeTurno({
  data,
  contado,
  setContado,
  diferencia,
  fechaLarga,
}: {
  data: CierreTurno;
  contado: string;
  setContado: (v: string) => void;
  diferencia: number | null;
  fechaLarga: string;
}) {
  const glow =
    diferencia === null
      ? undefined
      : diferencia === 0
        ? ("success" as const)
        : diferencia > 0
          ? ("warning" as const)
          : ("danger" as const);

  return (
    <div className="mx-auto max-w-xl px-4 py-6 lg:max-w-4xl lg:px-8 lg:py-8">
      <div className="mb-5">
        <PageHeader title="Cerrar turno" subtitle={fechaLarga} icon={Wallet} art="caja" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-start">
        <CardHero glow={glow}>
          <h2 className="text-sm font-medium text-muted-foreground">
            Contá la plata del cajón
          </h2>
          <p className="tabular mt-1 text-3xl font-semibold tracking-tight lg:text-4xl">
            {money(Number(data.efectivo_esperado))}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            es lo que debería haber
          </p>

          <div className="mt-4 border-t border-border pt-4">
            <label htmlFor="contado" className="text-sm font-medium">
              ¿Cuánto contaste?
            </label>
            <div className="relative mt-2">
              <span
                aria-hidden
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xl text-muted-foreground"
              >
                $
              </span>
              <input
                id="contado"
                value={contado}
                onChange={(e) => setContado(e.target.value.replace(/[^\d]/g, ""))}
                inputMode="numeric"
                placeholder="0"
                aria-label="Efectivo contado"
                className="tabular h-14 w-full rounded-lg border border-border bg-surface pl-9 pr-4 text-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            {diferencia !== null && (
              <p
                className={cn(
                  "mt-3 flex items-center gap-2 text-xl font-semibold",
                  diferencia === 0 && "text-success-ink",
                  diferencia > 0 && "text-warning-ink",
                  diferencia < 0 && "text-danger-ink",
                )}
                aria-live="polite"
              >
                {diferencia === 0 ? (
                  <Check className="size-5 shrink-0" aria-hidden />
                ) : (
                  <AlertTriangle className="size-5 shrink-0" aria-hidden />
                )}
                {diferencia === 0
                  ? "Justo. Cierra perfecto."
                  : diferencia > 0
                    ? `Sobran ${money(diferencia)}`
                    : `Faltan ${money(-diferencia)}`}
              </p>
            )}
          </div>
        </CardHero>

        <Card>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">Tu turno</h2>
          <dl className="divide-y divide-border text-sm">
            <div className="flex items-center justify-between py-2">
              <dt className="text-muted-foreground">Ventas</dt>
              <dd className="tabular text-lg font-semibold">{data.ventas_del_turno}</dd>
            </div>
            {Number(data.anuladas) > 0 && (
              <div className="flex items-center justify-between py-2">
                <dt className="text-muted-foreground">Anuladas</dt>
                <dd className="tabular text-lg font-semibold text-warning-ink">
                  {data.anuladas}
                </dd>
              </div>
            )}
          </dl>
        </Card>
      </div>
    </div>
  );
}
