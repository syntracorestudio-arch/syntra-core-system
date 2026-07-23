"use client";

import { useMemo, useState, useTransition, useCallback } from "react";
import {
  Search,
  Trash2,
  PackagePlus,
  LoaderCircle,
  Check,
  TriangleAlert,
  X,
  ScanBarcode,
  CalendarClock,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { PageHeader } from "@/components/ui/page-header";
import { money } from "@/lib/format";
import { registerPurchase } from "@/app/admin/productos/actions";
import { useWedgeScanner } from "@/components/pos/use-wedge-scanner";
import { CameraScanner } from "@/components/pos/camera-scanner";

export type IngresoProduct = {
  id: string;
  name: string;
  emoji: string | null;
  price: number;
  cost: number | null;
  stock: number;
  barcodes: string[];
};

type Linea = {
  producto: IngresoProduct;
  qty: string;
  costo: string;
  vence: string;
};

/** Atajos para el caso frecuente: nadie quiere abrir un calendario para poner
 *  "vence en una semana". La fecha exacta sigue disponible al lado. */
const ATAJOS = [
  { label: "1 semana", dias: 7 },
  { label: "15 días", dias: 15 },
  { label: "1 mes", dias: 30 },
] as const;

function enDias(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

/**
 * Ingreso de mercadería. Criterio del PRD: 10 productos en menos de 3 minutos.
 * Por eso el costo viene precargado con el último y el vencimiento es opcional
 * — si el kiosquero no lo carga, no pasa nada; si lo carga, gana las alertas.
 */
export function IngresoClient({ products }: { products: IngresoProduct[] }) {
  const [busqueda, setBusqueda] = useState("");
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [camara, setCamara] = useState(false);
  const [aviso, setAviso] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const porCodigo = useMemo(() => {
    const map = new Map<string, IngresoProduct>();
    for (const p of products) for (const b of p.barcodes) map.set(b, p);
    return map;
  }, [products]);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return [];
    return products
      .filter((p) => p.name.toLowerCase().includes(q) || p.barcodes.some((b) => b.includes(q)))
      .slice(0, 8);
  }, [busqueda, products]);

  const agregar = useCallback((p: IngresoProduct) => {
    setLineas((prev) => {
      if (prev.some((l) => l.producto.id === p.id)) return prev;
      return [
        ...prev,
        { producto: p, qty: "", costo: p.cost != null ? String(p.cost) : "", vence: "" },
      ];
    });
    setBusqueda("");
  }, []);

  const onScan = useCallback(
    (code: string) => {
      setCamara(false);
      const p = porCodigo.get(code.trim());
      if (p) agregar(p);
      else setAviso({ tone: "error", text: `El código ${code} no está en tu catálogo.` });
    },
    [porCodigo, agregar],
  );

  useWedgeScanner(onScan, !camara);

  function set(id: string, campo: keyof Omit<Linea, "producto">, valor: string) {
    setLineas((prev) => prev.map((l) => (l.producto.id === id ? { ...l, [campo]: valor } : l)));
  }

  const listas = lineas.filter((l) => Number(l.qty) > 0);

  function confirmar() {
    if (listas.length === 0) return;
    startTransition(async () => {
      const res = await registerPurchase({
        items: listas.map((l) => ({
          product_id: l.producto.id,
          qty: Number(l.qty),
          unit_cost: l.costo === "" ? null : Number(l.costo),
          expiry_date: l.vence || null,
        })),
      });
      if (!res.ok) {
        setAviso({ tone: "error", text: res.error });
        return;
      }
      setLineas([]);
      setAviso({
        tone: "ok",
        text: `Cargaste ${res.count} producto${res.count === 1 ? "" : "s"}. El stock ya está actualizado.`,
      });
    });
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 lg:px-8 lg:py-8">
      {camara && <CameraScanner onScan={onScan} onClose={() => setCamara(false)} />}

      <div className="mb-5">
        <PageHeader
          title="Recibí mercadería"
          subtitle="Escaneá o buscá, poné cuánto entró y confirmá."
          icon={PackagePlus}
        />
      </div>

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

      <div className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscá o escaneá lo que entró"
            aria-label="Buscar producto"
            className="h-11 w-full rounded-lg border border-input bg-card pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
          />
          {visibles.length > 0 && (
            <ul className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-lg border border-border bg-popover shadow-xl">
              {visibles.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => agregar(p)}
                    className="flex w-full cursor-pointer items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors hover:bg-secondary"
                  >
                    <span aria-hidden>{p.emoji ?? "📦"}</span>
                    <span className="min-w-0 flex-1 truncate">{p.name}</span>
                    <span className="tabular shrink-0 text-xs text-muted-foreground">
                      {p.stock} u.
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button
          type="button"
          onClick={() => setCamara(true)}
          aria-label="Escanear con la cámara"
          className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-lg bg-primary text-primary-foreground transition-opacity hover:opacity-90"
        >
          <ScanBarcode className="size-5" />
        </button>
      </div>

      {lineas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
          <PackagePlus className="mx-auto mb-3 size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Todavía no cargaste nada. Escaneá el primer producto que entró.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {lineas.map((l) => {
            const nuevoCosto = l.costo === "" ? null : Number(l.costo);
            const m =
              nuevoCosto !== null && l.producto.price > 0
                ? ((l.producto.price - nuevoCosto) / l.producto.price) * 100
                : null;
            return (
              <li key={l.producto.id} className="rounded-xl border border-border bg-card p-4">
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-lg" aria-hidden>
                    {l.producto.emoji ?? "📦"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{l.producto.name}</p>
                    <p className="tabular text-xs text-muted-foreground">
                      tenías {l.producto.stock} u. · se vende a {money(l.producto.price)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLineas((p) => p.filter((x) => x.producto.id !== l.producto.id))}
                    aria-label={`Quitar ${l.producto.name}`}
                    className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-md border border-border text-muted-foreground transition-colors hover:border-danger hover:text-danger-ink"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>

                {/* Cantidad y costo son los datos de SIEMPRE: van juntos y grandes. */}
                <div className="grid grid-cols-2 gap-2">
                  <Field label="¿Cuántos?" htmlFor={`q-${l.producto.id}`}>
                    <input
                      id={`q-${l.producto.id}`}
                      value={l.qty}
                      onChange={(e) => set(l.producto.id, "qty", e.target.value.replace(/[^\d]/g, ""))}
                      inputMode="numeric"
                      placeholder="12"
                      className="tabular h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary"
                    />
                  </Field>
                  <Field label="Costo c/u" htmlFor={`c-${l.producto.id}`}>
                    <input
                      id={`c-${l.producto.id}`}
                      value={l.costo}
                      onChange={(e) => set(l.producto.id, "costo", e.target.value.replace(/[^\d]/g, ""))}
                      inputMode="numeric"
                      className="tabular h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary"
                    />
                  </Field>
                </div>

                {/* El vencimiento tiene su propia fila. En un kiosco la mayoría de los
                    productos vencen dentro de mucho, así que pedir la fecha exacta en
                    cada línea es fricción sin ganancia: los atajos resuelven el caso
                    frecuente en un toque y la fecha exacta queda para cuando importa. */}
                <div className="mt-3 rounded-lg border border-border bg-background p-3">
                  <div className="mb-2 flex items-center gap-1.5">
                    <CalendarClock className="size-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium">
                      ¿Vence pronto? Te aviso antes
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {ATAJOS.map((a) => {
                      const valor = enDias(a.dias);
                      const activo = l.vence === valor;
                      return (
                        <button
                          key={a.label}
                          type="button"
                          onClick={() => set(l.producto.id, "vence", activo ? "" : valor)}
                          aria-pressed={activo}
                          className={cn(
                            "h-9 cursor-pointer rounded-lg border px-2.5 text-xs font-medium transition-colors",
                            activo
                              ? "border-primary bg-accent text-accent-foreground"
                              : "border-border text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {a.label}
                        </button>
                      );
                    })}
                    <input
                      id={`v-${l.producto.id}`}
                      type="date"
                      value={l.vence}
                      onChange={(e) => set(l.producto.id, "vence", e.target.value)}
                      aria-label={`Fecha de vencimiento de ${l.producto.name}`}
                      className="h-9 min-w-[8.5rem] flex-1 rounded-lg border border-input bg-card px-2 text-xs outline-none focus:border-primary"
                    />
                    {l.vence && (
                      <button
                        type="button"
                        onClick={() => set(l.producto.id, "vence", "")}
                        aria-label="Quitar vencimiento"
                        className="grid size-9 cursor-pointer place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-danger-ink"
                      >
                        <X className="size-3.5" />
                      </button>
                    )}
                  </div>

                  {l.vence && (
                    <p className="mt-2 text-xs text-success-ink">
                      Te aviso antes del {l.vence}
                    </p>
                  )}
                </div>

                {m !== null && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Margen con este costo:{" "}
                    <span className={cn("font-semibold", m < 15 ? "text-warning-ink" : "text-success-ink")}>
                      {m.toFixed(0)}%
                    </span>
                    {m < 15 && " — quizás convenga subir el precio."}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {lineas.length > 0 && (
        <div className="sticky bottom-0 mt-4 border-t border-border bg-background py-4">
          <button
            type="button"
            onClick={confirmar}
            disabled={listas.length === 0 || pending}
            className="flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary text-base font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {pending && <LoaderCircle className="size-4 animate-spin" />}
            Confirmar ingreso de {listas.length} producto{listas.length === 1 ? "" : "s"}
          </button>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={htmlFor} className="text-xs text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}
