"use client";

import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { Wallet, ArrowLeft } from "lucide-react";
import { registerPayment } from "@/app/admin/alumnos/[id]/actions";

export type PassOption = {
  id: string;
  name: string;
  credits: number;
  validityDays: number;
  price: number;
};

type Concept = "pack" | "drop_in" | "membership" | "abono";
type Method = "cash" | "transfer" | "card_manual";

const CONCEPTS: { v: Concept; label: string }[] = [
  { v: "pack", label: "Pack" },
  { v: "drop_in", label: "Clase suelta" },
  { v: "membership", label: "Membresía" },
  { v: "abono", label: "Abono" },
];
const METHODS: { v: Method; label: string }[] = [
  { v: "cash", label: "Efectivo" },
  { v: "transfer", label: "Transferencia" },
  { v: "card_manual", label: "Tarjeta" },
];

function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:opacity-90 disabled:opacity-60"
    >
      {pending ? "Registrando…" : "Confirmar pago"}
    </button>
  );
}

export function PaymentForm({ memberId, passes }: { memberId: string; passes: PassOption[] }) {
  const [step, setStep] = useState<"edit" | "confirm">("edit");
  const [concept, setConcept] = useState<Concept>(passes.length > 0 ? "pack" : "drop_in");
  const [method, setMethod] = useState<Method>("cash");
  const [passId, setPassId] = useState(passes[0]?.id ?? "");
  const [days, setDays] = useState(30);
  const [amount, setAmount] = useState<number>(passes[0]?.price ?? 0);

  const needsPass = concept === "pack";
  const needsDays = concept === "membership" || concept === "abono";
  const selectedPass = useMemo(() => passes.find((p) => p.id === passId) ?? null, [passes, passId]);

  const valid =
    amount > 0 && (!needsPass || !!selectedPass) && (!needsDays || days > 0);

  const conceptLabel = CONCEPTS.find((c) => c.v === concept)!.label;
  const methodLabel = METHODS.find((m) => m.v === method)!.label;
  const detail = needsPass
    ? selectedPass
      ? `${selectedPass.name} · ${selectedPass.credits} créditos (vence en ${selectedPass.validityDays} días)`
      : "—"
    : concept === "drop_in"
      ? "1 crédito (vence en 30 días)"
      : `${days} días de acceso`;

  return (
    <form action={registerPayment} className="grid gap-4">
      <input type="hidden" name="memberId" value={memberId} />
      <input type="hidden" name="concept" value={concept} />
      <input type="hidden" name="method" value={method} />
      <input type="hidden" name="amount" value={amount} />
      {needsPass ? <input type="hidden" name="pass_id" value={passId} /> : null}
      {needsDays ? <input type="hidden" name="membership_days" value={days} /> : null}

      {step === "edit" ? (
        <>
          {/* concepto */}
          <div className="grid gap-1.5 text-sm">
            <span className="font-medium text-foreground">Concepto</span>
            <div className="grid grid-cols-2 gap-2">
              {CONCEPTS.map((c) => {
                const active = concept === c.v;
                const disabled = c.v === "pack" && passes.length === 0;
                return (
                  <button
                    key={c.v}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      setConcept(c.v);
                      if (c.v === "pack" && selectedPass) setAmount(selectedPass.price);
                    }}
                    className={`min-h-11 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-foreground hover:bg-secondary"
                    } ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* pack a asignar */}
          {needsPass ? (
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium text-foreground">Pack</span>
              <select
                value={passId}
                onChange={(e) => {
                  setPassId(e.target.value);
                  const p = passes.find((x) => x.id === e.target.value);
                  if (p) setAmount(p.price);
                }}
                className="rounded-md border border-input bg-card px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-ring"
              >
                {passes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.credits} clases / {p.validityDays} días
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {/* días de membresía/abono */}
          {needsDays ? (
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium text-foreground">Días de acceso</span>
              <input
                type="number"
                min={1}
                max={365}
                value={days}
                onChange={(e) => setDays(Math.max(1, Number(e.target.value) || 1))}
                className="rounded-md border border-input bg-card px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
          ) : null}

          {/* método */}
          <div className="grid gap-1.5 text-sm">
            <span className="font-medium text-foreground">Método</span>
            <div className="grid grid-cols-3 gap-2">
              {METHODS.map((m) => {
                const active = method === m.v;
                return (
                  <button
                    key={m.v}
                    type="button"
                    onClick={() => setMethod(m.v)}
                    className={`min-h-11 rounded-lg border px-2 py-2 text-sm font-medium transition-colors ${
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-foreground hover:bg-secondary"
                    }`}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* monto */}
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium text-foreground">Monto</span>
            <div className="flex items-center rounded-md border border-input bg-card focus-within:ring-2 focus-within:ring-ring">
              <span className="pl-3 text-muted-foreground">$</span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))}
                className="w-full rounded-md bg-transparent px-2 py-2 text-foreground outline-none"
              />
            </div>
          </label>

          <button
            type="button"
            disabled={!valid}
            onClick={() => setStep("confirm")}
            className="mt-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:opacity-90 disabled:opacity-50"
          >
            Continuar
          </button>
        </>
      ) : (
        <>
          {/* resumen + confirmación */}
          <div className="rounded-xl border border-border bg-secondary/50 p-4">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <Wallet className="size-4 text-primary" aria-hidden />
              Revisá el pago
            </p>
            <dl className="mt-3 grid gap-1.5 text-sm">
              <Row k="Concepto" v={conceptLabel} />
              <Row k="Detalle" v={detail} />
              <Row k="Método" v={methodLabel} />
              <Row k="Monto" v={`$${amount.toLocaleString("es-AR")}`} strong />
            </dl>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep("edit")}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
            >
              <ArrowLeft className="size-4" aria-hidden />
              Volver
            </button>
            <ConfirmButton />
          </div>
        </>
      )}
    </form>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className={`text-right ${strong ? "text-base font-bold text-foreground" : "text-foreground"}`}>{v}</dd>
    </div>
  );
}
