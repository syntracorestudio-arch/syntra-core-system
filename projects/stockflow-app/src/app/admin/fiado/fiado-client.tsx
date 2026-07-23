"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  Search,
  UserPlus,
  ChevronRight,
  X,
  LoaderCircle,
  Wallet,
  PartyPopper,
  UsersRound,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { AvisoBanner } from "@/components/ui/aviso";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyArt } from "@/components/ui/empty-art";
import { CardHero } from "@/components/ui/card-system";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/format";
import { createClient } from "./actions";

export type ClientRow = {
  id: string;
  name: string;
  creditLimit: number | null;
  balance: number; // negativo = debe
  lastMovement: string | null;
};

type Aviso = { tone: "ok" | "error"; text: string } | null;

/** "hace 3 días" dice más que una fecha: el dueño quiere saber si la deuda duerme. */
export function haceCuanto(iso: string | null): string | null {
  if (!iso) return null;
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (dias <= 0) return "hoy";
  if (dias === 1) return "ayer";
  if (dias < 30) return `hace ${dias} días`;
  const meses = Math.floor(dias / 30);
  return meses === 1 ? "hace un mes" : `hace ${meses} meses`;
}

export function FiadoClient({
  clients,
  canCreate,
}: {
  clients: ClientRow[];
  canCreate: boolean;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [creando, setCreando] = useState(false);
  const [aviso, setAviso] = useState<Aviso>(null);

  const deudores = clients.filter((c) => c.balance < 0);
  const totalCalle = deudores.reduce((a, c) => a + Math.abs(c.balance), 0);
  const sobreLimite = deudores.filter(
    (c) => c.creditLimit !== null && Math.abs(c.balance) > c.creditLimit,
  ).length;

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) => c.name.toLowerCase().includes(q));
  }, [busqueda, clients]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 lg:px-8 lg:py-8">
      <div className="mb-5">
        <PageHeader
          title="Fiado"
          subtitle={`${
            deudores.length === 0
              ? "Nadie te debe nada."
              : `${deudores.length} ${deudores.length === 1 ? "persona te debe" : "personas te deben"}`
          }${sobreLimite > 0 ? ` · ${sobreLimite} pasó su límite` : ""}`}
          icon={UsersRound}
        >
          {canCreate && (
            <Button variant="primary" onClick={() => setCreando(true)}>
              <UserPlus className="size-4" /> Nueva cuenta
            </Button>
          )}
        </PageHeader>
      </div>

      <AvisoBanner aviso={aviso} onClose={() => setAviso(null)} />

      {deudores.length > 0 && (
        <CardHero className="mb-4">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Wallet className="size-4" />
            Fiado en la calle
          </div>
          <p className="tabular mt-1 text-3xl font-semibold">{money(totalCalle)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Es plata tuya que todavía no cobraste.
          </p>
        </CardHero>
      )}

      {clients.length > 3 && (
        <div className="relative mb-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar persona"
            aria-label="Buscar persona"
            className="h-11 w-full rounded-lg border border-input bg-card pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
          />
        </div>
      )}

      {clients.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-6 py-14 text-center">
          <EmptyArt name="fiado" alt="Una libreta cerrada" />
          <p className="text-sm font-medium">Todavía no llevás fiado</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Cuando le fíes a alguien desde la caja, su cuenta aparece acá. Se acabó el
            cuaderno.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-[#0e1219]">
          {visibles.map((c) => {
            const debe = c.balance < 0;
            const monto = Math.abs(c.balance);
            const pasado = c.creditLimit !== null && monto > c.creditLimit;
            return (
              <li key={c.id}>
                <Link
                  href={`/admin/fiado/${c.id}`}
                  className="flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-secondary"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {debe
                        ? (haceCuanto(c.lastMovement) ?? "sin movimientos")
                        : c.balance > 0
                          ? "tiene saldo a favor"
                          : "al día"}
                      {pasado && " · pasó su límite"}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "tabular shrink-0 text-sm font-semibold",
                      debe && pasado && "text-danger-ink",
                      debe && !pasado && "text-foreground",
                      !debe && "text-success-ink",
                    )}
                  >
                    {debe ? money(monto) : c.balance > 0 ? `+${money(c.balance)}` : money(0)}
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            );
          })}
          {visibles.length === 0 && (
            <li className="px-4 py-10 text-center text-sm text-muted-foreground">
              Nadie con ese nombre.
            </li>
          )}
        </ul>
      )}

      {deudores.length === 0 && clients.length > 0 && (
        <p className="mt-4 flex items-center justify-center gap-2 text-sm text-success-ink">
          <PartyPopper className="size-4" /> No tenés plata en la calle.
        </p>
      )}

      {creando && (
        <NuevaCuentaDialog
          onClose={() => setCreando(false)}
          onDone={() => {
            setCreando(false);
            setAviso({ tone: "ok", text: "Cuenta abierta." });
          }}
          onError={(e) => setAviso({ tone: "error", text: e })}
        />
      )}
    </div>
  );
}

function NuevaCuentaDialog({
  onClose,
  onDone,
  onError,
}: {
  onClose: () => void;
  onDone: () => void;
  onError: (msg: string) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [limite, setLimite] = useState("");
  const [pending, startTransition] = useTransition();

  function guardar() {
    startTransition(async () => {
      const res = await createClient({
        name,
        phone: phone || null,
        credit_limit: limite === "" ? null : Number(limite),
        note: null,
      });
      if (!res.ok) {
        onError(res.error);
        return;
      }
      onDone();
    });
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-end overflow-y-auto bg-black/60 sm:place-items-center sm:p-4">
      <div className="w-full rounded-t-2xl border border-border bg-popover p-5 sm:max-w-sm sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Nueva cuenta</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="cursor-pointer text-muted-foreground hover:text-foreground">
            <X className="size-5" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label htmlFor="nc-name" className="text-sm font-medium">
              ¿Cómo se llama?
            </label>
            <input
              id="nc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              placeholder="Marta González"
              className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="nc-phone" className="text-sm font-medium">
              Teléfono
            </label>
            <input
              id="nc-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              placeholder="opcional"
              className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="nc-limit" className="text-sm font-medium">
              Avisarme si pasa de
            </label>
            <div className="flex items-center gap-2">
              <input
                id="nc-limit"
                value={limite}
                onChange={(e) => setLimite(e.target.value.replace(/[^\d]/g, ""))}
                inputMode="numeric"
                placeholder="20000"
                className="tabular h-11 w-32 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary"
              />
              <span className="text-sm text-muted-foreground">de deuda</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Es solo un aviso: la venta pasa igual. Vos decidís en el mostrador.
            </p>
          </div>

          <button
            type="button"
            onClick={guardar}
            disabled={pending || !name.trim()}
            className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {pending && <LoaderCircle className="size-4 animate-spin" />}
            Abrir cuenta
          </button>
        </div>
      </div>
    </div>
  );
}
