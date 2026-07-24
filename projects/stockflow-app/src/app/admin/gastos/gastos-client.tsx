"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Receipt,
  Plus,
  X,
  LoaderCircle,
  Ban,
  Building2,
  Zap,
  Users,
  Landmark,
  Boxes,
  Wrench,
  CircleDashed,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { AvisoBanner, type AvisoData } from "@/components/ui/aviso";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyArt } from "@/components/ui/empty-art";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/format";
import { registerExpenseAction, voidExpenseAction } from "./actions";

export type ExpenseRow = {
  id: string;
  category: string;
  amount: number;
  incurred_on: string;
  note: string | null;
  is_recurring: boolean;
  status: "active" | "voided";
  void_reason: string | null;
  created_at: string;
};

/** Keys inglés (CHECK de `expenses`) → label castellano (modelo mental del
    kiosquero). Único lugar del mapa: lo reusa Reportes para el desglose. */
export const CATEGORIA_LABEL: Record<string, string> = {
  rent: "Alquiler",
  utilities: "Servicios",
  salary: "Sueldos",
  taxes: "Impuestos",
  supplies: "Insumos",
  maintenance: "Mantenimiento",
  other: "Otros",
};

/** Orden de presentación + ícono por categoría (Lucide, sin color chillón: el
    verde queda sagrado para la plata, jamás para un gasto). */
const CATEGORIAS: { key: string; label: string; icon: LucideIcon }[] = [
  { key: "rent", label: "Alquiler", icon: Building2 },
  { key: "utilities", label: "Servicios", icon: Zap },
  { key: "salary", label: "Sueldos", icon: Users },
  { key: "taxes", label: "Impuestos", icon: Landmark },
  { key: "supplies", label: "Insumos", icon: Boxes },
  { key: "maintenance", label: "Mantenimiento", icon: Wrench },
  { key: "other", label: "Otros", icon: CircleDashed },
];

const CATEGORIA_ICON: Record<string, LucideIcon> = Object.fromEntries(
  CATEGORIAS.map((c) => [c.key, c.icon]),
);

const hoyISO = () => new Date().toISOString().slice(0, 10);

const mesLabel = (key: string) => {
  const s = new Intl.DateTimeFormat("es-AR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${key}-01T00:00:00Z`));
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const diaLabel = (iso: string) =>
  new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${iso}T00:00:00Z`),
  );

export function GastosClient({ expenses }: { expenses: ExpenseRow[] }) {
  const [creando, setCreando] = useState(false);
  const [anulando, setAnulando] = useState<ExpenseRow | null>(null);
  const [aviso, setAviso] = useState<AvisoData>(null);

  // Agrupado por mes (YYYY-MM), meses desc; el total del mes suma solo activos.
  const meses = useMemo(() => {
    const map = new Map<string, ExpenseRow[]>();
    for (const e of expenses) {
      const key = e.incurred_on.slice(0, 7);
      const list = map.get(key) ?? [];
      list.push(e);
      map.set(key, list);
    }
    return [...map.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([key, items]) => ({
        key,
        items,
        total: items.reduce((a, e) => a + (e.status === "active" ? e.amount : 0), 0),
      }));
  }, [expenses]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 lg:px-8 lg:py-8">
      <div className="mb-5">
        <PageHeader
          title="Gastos"
          subtitle="Alquiler, luz, sueldos: lo que sale todos los meses."
          icon={Receipt}
          art="caja"
        >
          <Button variant="primary" onClick={() => setCreando(true)}>
            <Plus className="size-4" /> Nuevo gasto
          </Button>
        </PageHeader>
      </div>

      <AvisoBanner aviso={aviso} onClose={() => setAviso(null)} />

      {expenses.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-6 py-14 text-center">
          <EmptyArt name="caja" alt="Un billete de vidrio negro" />
          <p className="text-sm font-medium">Todavía no cargaste gastos</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Cargá el alquiler, la luz o los sueldos y Reportes te muestra tu ganancia
            real: lo que te queda después de pagar todo.
          </p>
          <div className="mt-5">
            <Button variant="primary" onClick={() => setCreando(true)}>
              <Plus className="size-4" /> Cargá tu primer gasto
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {meses.map((mes) => (
            <section key={mes.key}>
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <h2 className="text-sm font-semibold">{mesLabel(mes.key)}</h2>
                <span className="tabular text-sm font-semibold text-muted-foreground">
                  {money(mes.total)}
                </span>
              </div>
              <ul className="divide-y divide-border rounded-xl border border-border bg-[#0e1219]">
                {mes.items.map((e) => {
                  const anulada = e.status === "voided";
                  const Icon = CATEGORIA_ICON[e.category] ?? CircleDashed;
                  return (
                    <li
                      key={e.id}
                      className={cn("flex items-center gap-3 px-4 py-3", anulada && "opacity-50")}
                    >
                      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary text-muted-foreground">
                        <Icon className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={cn("truncate text-sm font-medium", anulada && "line-through")}>
                            {CATEGORIA_LABEL[e.category] ?? e.category}
                          </span>
                          {e.is_recurring && (
                            <span className="shrink-0 rounded bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                              fijo
                            </span>
                          )}
                          {anulada && (
                            <span className="shrink-0 rounded bg-danger/15 px-1.5 py-0.5 text-[10px] font-medium text-danger-ink">
                              Anulado
                            </span>
                          )}
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                          {diaLabel(e.incurred_on)}
                          {e.note && ` · ${e.note}`}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "tabular shrink-0 text-sm font-semibold",
                          anulada && "line-through",
                        )}
                      >
                        {money(e.amount)}
                      </span>
                      {!anulada && (
                        <button
                          type="button"
                          onClick={() => setAnulando(e)}
                          aria-label="Anular este gasto"
                          className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-md border border-border text-muted-foreground transition-colors hover:border-danger hover:text-danger-ink"
                        >
                          <Ban className="size-3.5" />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {creando && (
        <NuevoGastoDialog
          onClose={() => setCreando(false)}
          onDone={() => {
            setCreando(false);
            setAviso({ tone: "ok", text: "Gasto cargado." });
          }}
          onError={(e) => setAviso({ tone: "error", text: e })}
        />
      )}

      {anulando && (
        <AnularGastoDialog
          gasto={anulando}
          onClose={() => setAnulando(null)}
          onDone={() => {
            setAnulando(null);
            setAviso({ tone: "ok", text: "Gasto anulado. Vuelve a subir tu ganancia del período." });
          }}
          onError={(e) => setAviso({ tone: "error", text: e })}
        />
      )}
    </div>
  );
}

function NuevoGastoDialog({
  onClose,
  onDone,
  onError,
}: {
  onClose: () => void;
  onDone: () => void;
  onError: (msg: string) => void;
}) {
  const [category, setCategory] = useState("rent");
  const [monto, setMonto] = useState("");
  const [fecha, setFecha] = useState(hoyISO());
  const [nota, setNota] = useState("");
  const [fijo, setFijo] = useState(false);
  const [pending, startTransition] = useTransition();

  const esOtros = category === "other";
  const puedeGuardar = Number(monto) > 0;

  function guardar() {
    startTransition(async () => {
      const res = await registerExpenseAction({
        category,
        amount: Number(monto),
        incurred_on: fecha,
        note: nota.trim() || null,
        is_recurring: fijo,
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
      <div className="w-full rounded-t-2xl border border-border bg-popover p-5 sm:max-w-md sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Nuevo gasto</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="cursor-pointer text-muted-foreground hover:text-foreground">
            <X className="size-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <span className="text-sm font-medium">¿Qué gasto es?</span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {CATEGORIAS.map((c) => {
                const activo = c.key === category;
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setCategory(c.key)}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                      activo
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border text-muted-foreground hover:border-[#2e3c55] hover:text-foreground",
                    )}
                  >
                    <c.icon className="size-4 shrink-0" />
                    <span className="truncate">{c.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="ng-monto" className="text-sm font-medium">¿Cuánto?</label>
            <div className="flex items-center gap-2 rounded-lg border border-input bg-background px-3 focus-within:border-primary">
              <span className="text-lg text-muted-foreground">$</span>
              <input
                id="ng-monto"
                value={monto}
                onChange={(e) => setMonto(e.target.value.replace(/[^\d]/g, ""))}
                inputMode="numeric"
                autoFocus
                placeholder="0"
                className="tabular h-14 w-full bg-transparent text-2xl font-semibold outline-none placeholder:text-muted-foreground"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="ng-fecha" className="text-sm font-medium">¿De qué mes es?</label>
            <input
              id="ng-fecha"
              type="date"
              value={fecha}
              max={hoyISO()}
              onChange={(e) => setFecha(e.target.value)}
              className="tabular h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary"
            />
            <p className="text-xs text-muted-foreground">Se imputa al mes de esta fecha.</p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="ng-nota" className="text-sm font-medium">
              Nota{" "}
              <span className="text-muted-foreground">
                {esOtros ? "(conviene aclarar qué es)" : "(opcional)"}
              </span>
            </label>
            <input
              id="ng-nota"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              maxLength={200}
              placeholder={esOtros ? "Ej: reparación del freezer" : "opcional"}
              className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary"
            />
          </div>

          <button
            type="button"
            onClick={() => setFijo((v) => !v)}
            className="flex w-full cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-left"
          >
            <span
              className={cn(
                "relative h-6 w-10 shrink-0 rounded-full transition-colors",
                fijo ? "bg-primary" : "bg-secondary",
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 size-5 rounded-full bg-white transition-transform",
                  fijo ? "translate-x-[1.125rem]" : "translate-x-0.5",
                )}
              />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">Es un gasto fijo</span>
              <span className="block text-xs text-muted-foreground">
                Se repite todos los meses (alquiler, sueldos). Por ahora es solo una etiqueta.
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={guardar}
            disabled={pending || !puedeGuardar}
            className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {pending && <LoaderCircle className="size-4 animate-spin" />}
            Guardar gasto
          </button>
        </div>
      </div>
    </div>
  );
}

function AnularGastoDialog({
  gasto,
  onClose,
  onDone,
  onError,
}: {
  gasto: ExpenseRow;
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
          <h2 className="text-sm font-semibold">Anular este gasto</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="cursor-pointer text-muted-foreground hover:text-foreground">
            <X className="size-5" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="rounded-lg border border-border bg-background p-3">
            <p className="text-sm font-medium">{CATEGORIA_LABEL[gasto.category] ?? gasto.category}</p>
            <p className="tabular mt-0.5 text-lg font-semibold">{money(gasto.amount)}</p>
          </div>

          <p className="text-sm text-muted-foreground">
            Cambia tu ganancia del período: el gasto queda registrado como anulado, no se
            borra.
          </p>

          <div className="space-y-1.5">
            <label htmlFor="ag-motivo" className="text-sm font-medium">
              ¿Por qué lo anulás? (opcional)
            </label>
            <input
              id="ag-motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              autoFocus
              placeholder="Lo cargué dos veces"
              className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary"
            />
          </div>

          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const res = await voidExpenseAction(gasto.id, motivo);
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
            Anular el gasto
          </button>
        </div>
      </div>
    </div>
  );
}
