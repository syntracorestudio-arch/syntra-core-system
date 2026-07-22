"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Banknote,
  QrCode,
  CreditCard,
  ArrowRightLeft,
  X,
  LoaderCircle,
  Check,
  TriangleAlert,
  ShoppingBasket,
  HandCoins,
  Pencil,
  MessageCircle,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { money } from "@/lib/format";
import { registerPayment, adjustBalance } from "../actions";

export type Movimiento = {
  id: string;
  delta: number;
  reason: string;
  paymentMethod: string | null;
  note: string | null;
  createdAt: string;
};

const MEDIOS = [
  { key: "cash", label: "Efectivo", icon: Banknote },
  { key: "qr", label: "QR", icon: QrCode },
  { key: "card", label: "Tarjeta", icon: CreditCard },
  { key: "transfer", label: "Transfer.", icon: ArrowRightLeft },
] as const;

export function ClienteDetalle({
  clientId,
  name,
  phone,
  creditLimit,
  balance,
  movimientos,
  canCharge,
  isOwner,
}: {
  clientId: string;
  name: string;
  phone: string | null;
  creditLimit: number | null;
  balance: number;
  movimientos: Movimiento[];
  canCharge: boolean;
  isOwner: boolean;
}) {
  const [cobrando, setCobrando] = useState(false);
  const [ajustando, setAjustando] = useState(false);
  const [aviso, setAviso] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const debe = balance < 0;
  const monto = Math.abs(balance);
  const pasado = creditLimit !== null && monto > creditLimit;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 lg:px-8 lg:py-8">
      <Link
        href="/admin/fiado"
        className="mb-4 inline-flex cursor-pointer items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Fiado
      </Link>

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

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold tracking-tight">{name}</h1>
            {phone && <p className="text-sm text-muted-foreground">{phone}</p>}
          </div>
          {phone && (
            /* El recordatorio por WhatsApp lo manda el dueño con su propio texto:
               automatizarlo es Fase 2 (n8n) y requiere su OK. */
            <a
              href={`https://wa.me/${phone.replace(/[^\d]/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium transition-colors hover:border-primary"
            >
              <MessageCircle className="size-4" /> WhatsApp
            </a>
          )}
        </div>

        <div className="mt-4">
          <p className="text-sm text-muted-foreground">
            {debe ? "Te debe" : balance > 0 ? "Tiene a favor" : "Está al día"}
          </p>
          <p
            className={cn(
              "tabular text-4xl font-semibold",
              debe && pasado && "text-danger-ink",
              !debe && balance > 0 && "text-success-ink",
            )}
          >
            {money(monto)}
          </p>
          {creditLimit !== null && (
            <p className={cn("mt-1 text-xs", pasado ? "text-danger-ink" : "text-muted-foreground")}>
              {pasado
                ? `Pasó el límite de ${money(creditLimit)} que le pusiste.`
                : `Límite: ${money(creditLimit)}`}
            </p>
          )}
        </div>

        {canCharge && debe && (
          <button
            type="button"
            onClick={() => setCobrando(true)}
            className="mt-4 flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            <HandCoins className="size-4" /> Registrar un pago
          </button>
        )}

        {isOwner && (
          <button
            type="button"
            onClick={() => setAjustando(true)}
            className="mt-2 flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <Pencil className="size-3.5" /> Ajustar saldo a mano
          </button>
        )}
      </section>

      <h2 className="mb-2 mt-6 text-sm font-medium text-muted-foreground">Movimientos</h2>
      {movimientos.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
          Todavía no hay movimientos en esta cuenta.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {movimientos.map((m) => {
            const esPago = m.delta > 0;
            return (
              <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                <div
                  className={cn(
                    "grid size-8 shrink-0 place-items-center rounded-lg",
                    esPago ? "bg-success/15 text-success-ink" : "bg-secondary text-muted-foreground",
                  )}
                >
                  {esPago ? <HandCoins className="size-4" /> : <ShoppingBasket className="size-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {esPago ? "Pagó" : m.reason === "sale" ? "Se llevó fiado" : "Ajuste"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(m.createdAt).toLocaleDateString("es-AR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })}
                    {m.note && ` · ${m.note}`}
                  </p>
                </div>
                {/* Signo explícito además del color: el color nunca informa solo. */}
                <span
                  className={cn(
                    "tabular shrink-0 text-sm font-semibold",
                    esPago ? "text-success-ink" : "text-foreground",
                  )}
                >
                  {esPago ? "+" : "−"}
                  {money(Math.abs(m.delta))}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {cobrando && (
        <CobrarDialog
          clientId={clientId}
          deuda={monto}
          onClose={() => setCobrando(false)}
          onDone={(saldado) => {
            setCobrando(false);
            setAviso({
              tone: "ok",
              text: saldado ? "Pago registrado. Cuenta saldada." : "Pago registrado.",
            });
          }}
          onError={(e) => setAviso({ tone: "error", text: e })}
        />
      )}

      {ajustando && (
        <AjusteDialog
          clientId={clientId}
          onClose={() => setAjustando(false)}
          onDone={() => {
            setAjustando(false);
            setAviso({ tone: "ok", text: "Saldo ajustado." });
          }}
          onError={(e) => setAviso({ tone: "error", text: e })}
        />
      )}
    </div>
  );
}

function CobrarDialog({
  clientId,
  deuda,
  onClose,
  onDone,
  onError,
}: {
  clientId: string;
  deuda: number;
  onClose: () => void;
  onDone: (saldado: boolean) => void;
  onError: (msg: string) => void;
}) {
  const [monto, setMonto] = useState("");
  const [medio, setMedio] = useState<(typeof MEDIOS)[number]["key"]>("cash");
  const [pending, startTransition] = useTransition();

  const n = Number(monto) || 0;
  const restante = deuda - n;

  function cobrar() {
    startTransition(async () => {
      const res = await registerPayment({
        client_id: clientId,
        amount: n,
        payment_method: medio,
      });
      if (!res.ok) {
        onError(res.error);
        return;
      }
      onDone(res.settled);
    });
  }

  return (
    <Dialog title="Registrar un pago" onClose={onClose}>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <label htmlFor="cb-monto" className="text-sm font-medium">
            ¿Cuánto te pagó?
          </label>
          <input
            id="cb-monto"
            value={monto}
            onChange={(e) => setMonto(e.target.value.replace(/[^\d]/g, ""))}
            inputMode="numeric"
            autoFocus
            placeholder="0"
            className="tabular h-12 w-full rounded-lg border border-input bg-background px-3 text-lg outline-none focus:border-primary"
          />
          {/* Pagar todo es el caso más común: un toque y listo. */}
          <button
            type="button"
            onClick={() => setMonto(String(Math.round(deuda)))}
            className="cursor-pointer text-xs text-primary-ink hover:underline"
          >
            Pagó todo ({money(deuda)})
          </button>
        </div>

        <div className="space-y-1.5">
          <span className="text-sm font-medium">¿Cómo te pagó?</span>
          <div className="grid grid-cols-4 gap-1.5">
            {MEDIOS.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setMedio(m.key)}
                aria-pressed={medio === m.key}
                className={cn(
                  "flex cursor-pointer flex-col items-center gap-1 rounded-lg border px-1 py-2 text-[10px] transition-colors",
                  medio === m.key
                    ? "border-primary bg-accent text-accent-foreground"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                <m.icon className="size-4" />
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {n > 0 && (
          <p className="rounded-lg bg-background px-3 py-2 text-sm">
            {restante > 0 ? (
              <>
                Le van a quedar debiendo{" "}
                <span className="tabular font-semibold">{money(restante)}</span>
              </>
            ) : restante === 0 ? (
              <span className="text-success-ink">Queda al día.</span>
            ) : (
              <>
                Le queda{" "}
                <span className="tabular font-semibold text-success-ink">
                  {money(-restante)} a favor
                </span>
              </>
            )}
          </p>
        )}

        <button
          type="button"
          onClick={cobrar}
          disabled={pending || n <= 0}
          className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {pending && <LoaderCircle className="size-4 animate-spin" />}
          Registrar pago
        </button>
      </div>
    </Dialog>
  );
}

function AjusteDialog({
  clientId,
  onClose,
  onDone,
  onError,
}: {
  clientId: string;
  onClose: () => void;
  onDone: () => void;
  onError: (msg: string) => void;
}) {
  const [monto, setMonto] = useState("");
  const [motivo, setMotivo] = useState("");
  const [pending, startTransition] = useTransition();

  function aplicar() {
    startTransition(async () => {
      const res = await adjustBalance(clientId, Number(monto), motivo);
      if (!res.ok) {
        onError(res.error);
        return;
      }
      onDone();
    });
  }

  return (
    <Dialog title="Ajustar saldo a mano" onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Para corregir una carga mal hecha o perdonar una deuda. Queda registrado.
        </p>
        <div className="space-y-1.5">
          <label htmlFor="aj-monto" className="text-sm font-medium">
            Monto
          </label>
          <input
            id="aj-monto"
            value={monto}
            onChange={(e) => setMonto(e.target.value.replace(/[^\d-]/g, ""))}
            inputMode="numeric"
            placeholder="Positivo le baja la deuda, negativo se la sube"
            className="tabular h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="aj-motivo" className="text-sm font-medium">
            ¿Por qué?
          </label>
          <input
            id="aj-motivo"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Le perdoné el resto"
            className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary"
          />
        </div>
        <button
          type="button"
          onClick={aplicar}
          disabled={pending || !monto || !motivo.trim()}
          className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {pending && <LoaderCircle className="size-4 animate-spin" />}
          Aplicar ajuste
        </button>
      </div>
    </Dialog>
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
    <div className="fixed inset-0 z-50 grid place-items-end overflow-y-auto bg-black/60 sm:place-items-center sm:p-4">
      <div className="w-full rounded-t-2xl border border-border bg-popover p-5 sm:max-w-sm sm:rounded-2xl">
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
