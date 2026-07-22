"use client";

import { useMemo, useState, useTransition, useCallback, useRef } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ScanBarcode,
  Search,
  Plus,
  Minus,
  Trash2,
  Banknote,
  QrCode,
  CreditCard,
  ArrowRightLeft,
  UserRound,
  X,
  Check,
  TriangleAlert,
  LoaderCircle,
  PackagePlus,
  LogOut,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { money } from "@/lib/format";
import { registerSale, quickCreateProduct, buscarEnCatalogo } from "@/app/pos/actions";
import { signOut } from "@/app/login/actions";
import { useWedgeScanner } from "./use-wedge-scanner";
import { CameraScanner } from "./camera-scanner";

export type PosProduct = {
  id: string;
  name: string;
  emoji: string | null;
  color: string | null;
  price: number;
  stock: number;
  categoryName: string | null;
  barcodes: string[];
};

type Client = { id: string; name: string; phone: string | null };
type Linea = { producto: PosProduct; cantidad: number };

const MEDIOS = [
  { key: "cash", label: "Efectivo", icon: Banknote },
  { key: "qr", label: "QR", icon: QrCode },
  { key: "card", label: "Tarjeta", icon: CreditCard },
  { key: "transfer", label: "Transfer.", icon: ArrowRightLeft },
  { key: "account", label: "Fiado", icon: UserRound },
] as const;

type Medio = (typeof MEDIOS)[number]["key"];

export function PosScreen({
  storeName,
  products,
  clients,
  canSellOnCredit,
  isOwner,
}: {
  storeName: string;
  products: PosProduct[];
  clients: Client[];
  canSellOnCredit: boolean;
  isOwner: boolean;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [carrito, setCarrito] = useState<Linea[]>([]);
  const [medio, setMedio] = useState<Medio>("cash");
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [camaraAbierta, setCamaraAbierta] = useState(false);
  const [aviso, setAviso] = useState<{ tone: "ok" | "warn" | "error"; text: string } | null>(null);
  const [altaRapida, setAltaRapida] = useState<{
    barcode: string | null;
    sugerencia: { nombre: string; marca: string | null } | null;
  } | null>(null);
  const [pending, startTransition] = useTransition();

  /** Clave de idempotencia por carrito: si se corta la red y el cajero reintenta,
   *  la RPC devuelve la MISMA venta en vez de cobrar dos veces. */
  const idempotencyKey = useRef(crypto.randomUUID());

  const porCodigo = useMemo(() => {
    const map = new Map<string, PosProduct>();
    for (const p of products) for (const b of p.barcodes) map.set(b, p);
    return map;
  }, [products]);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.barcodes.some((b) => b.includes(q)),
    );
  }, [busqueda, products]);

  const total = carrito.reduce((a, l) => a + l.producto.price * l.cantidad, 0);
  const unidades = carrito.reduce((a, l) => a + l.cantidad, 0);

  const agregar = useCallback((producto: PosProduct) => {
    setCarrito((prev) => {
      const existente = prev.find((l) => l.producto.id === producto.id);
      if (existente) {
        return prev.map((l) =>
          l.producto.id === producto.id ? { ...l, cantidad: l.cantidad + 1 } : l,
        );
      }
      return [...prev, { producto, cantidad: 1 }];
    });
  }, []);

  /** Un beep del lector o de la cámara entra por acá. */
  const onScan = useCallback(
    (code: string) => {
      setCamaraAbierta(false);
      const encontrado = porCodigo.get(code.trim());
      if (encontrado) {
        agregar(encontrado);
        setAviso({ tone: "ok", text: `${encontrado.name} agregado` });
        return;
      }
      // Código desconocido → se consulta el catálogo compartido y recién ahí se
      // abre el alta, ya con el nombre puesto si lo reconocimos.
      const codigo = code.trim();
      buscarEnCatalogo(codigo)
        .then((sug) => setAltaRapida({ barcode: codigo, sugerencia: sug }))
        .catch(() => setAltaRapida({ barcode: codigo, sugerencia: null }));
    },
    [porCodigo, agregar],
  );

  useWedgeScanner(onScan, !camaraAbierta && !altaRapida);

  function cambiar(id: string, delta: number) {
    setCarrito((prev) =>
      prev
        .map((l) => (l.producto.id === id ? { ...l, cantidad: l.cantidad + delta } : l))
        .filter((l) => l.cantidad > 0),
    );
  }

  function cobrar() {
    if (carrito.length === 0 || pending) return;
    if (medio === "account" && !clienteId) {
      setAviso({ tone: "error", text: "Elegí a quién le fiás." });
      return;
    }

    startTransition(async () => {
      const res = await registerSale({
        items: carrito.map((l) => ({
          product_id: l.producto.id,
          qty: l.cantidad,
        })),
        payment_method: medio,
        idempotency_key: idempotencyKey.current,
        client_id: medio === "account" ? clienteId : null,
      });

      if (!res.ok) {
        setAviso({ tone: "error", text: res.error });
        return;
      }

      // Venta cerrada: carrito nuevo y clave nueva.
      setCarrito([]);
      setClienteId(null);
      setMedio("cash");
      idempotencyKey.current = crypto.randomUUID();

      if (res.negativeStock.length > 0) {
        const nombres = res.negativeStock.map((n) => n.name).join(", ");
        setAviso({
          tone: "warn",
          text: `Cobrado ${money(res.total)}. Ojo: ${nombres} quedó en negativo — revisá el stock.`,
        });
      } else if (res.overLimit) {
        setAviso({
          tone: "warn",
          text: `Cobrado ${money(res.total)}. Ese cliente pasó su límite de fiado.`,
        });
      } else {
        setAviso({ tone: "ok", text: `Cobrado ${money(res.total)}` });
      }
    });
  }

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      {camaraAbierta && (
        <CameraScanner onScan={onScan} onClose={() => setCamaraAbierta(false)} />
      )}

      {altaRapida && (
        <AltaRapida
          barcode={altaRapida.barcode}
          sugerencia={altaRapida.sugerencia}
          canCreate={isOwner}
          onCancel={() => setAltaRapida(null)}
          onCreated={(p) => {
            setAltaRapida(null);
            agregar({ ...p, emoji: "📦", color: null, stock: 0, categoryName: null, barcodes: [] });
            setAviso({ tone: "ok", text: `${p.name} creado y agregado` });
          }}
        />
      )}

      {/* Catálogo */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
          <div className="flex items-center gap-2">
            {isOwner ? (
              <Link
                href="/admin"
                aria-label="Volver al resumen"
                className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-lg border border-border text-muted-foreground transition-colors duration-150 hover:text-foreground"
              >
                <ArrowLeft className="size-5" />
              </Link>
            ) : (
              /* Para el empleado el POS es toda la app: si no le damos salida acá,
                 no tiene ninguna forma de cerrar sesión. */
              <form action={signOut}>
                <button
                  type="submit"
                  aria-label="Cerrar sesión"
                  className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-lg border border-border text-muted-foreground transition-colors duration-150 hover:text-foreground"
                >
                  <LogOut className="size-5" />
                </button>
              </form>
            )}
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscá o escaneá un código"
                aria-label="Buscar producto"
                className="h-11 w-full rounded-lg border border-input bg-card pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
              />
            </div>
            <button
              type="button"
              onClick={() => setCamaraAbierta(true)}
              aria-label="Escanear con la cámara"
              className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-lg bg-primary text-primary-foreground transition-opacity duration-150 hover:opacity-90"
            >
              <ScanBarcode className="size-5" />
            </button>
          </div>
          <p className="mt-1.5 truncate text-xs text-muted-foreground">{storeName}</p>
        </header>

        {aviso && (
          <div
            role="status"
            className={cn(
              "mx-4 mt-3 flex items-start gap-2 rounded-lg px-3 py-2 text-sm ring-1",
              aviso.tone === "ok" && "bg-success/10 text-success-ink ring-success/25",
              aviso.tone === "warn" && "bg-warning/10 text-warning-ink ring-warning/25",
              aviso.tone === "error" && "bg-danger/10 text-danger-ink ring-danger/25",
            )}
          >
            {aviso.tone === "ok" ? (
              <Check className="mt-0.5 size-4 shrink-0" />
            ) : (
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            )}
            <span className="flex-1">{aviso.text}</span>
            <button
              type="button"
              onClick={() => setAviso(null)}
              aria-label="Cerrar aviso"
              className="cursor-pointer opacity-60 hover:opacity-100"
            >
              <X className="size-4" />
            </button>
          </div>
        )}

        {visibles.length === 0 ? (
          <div className="grid flex-1 place-items-center px-8 py-16 text-center">
            <div>
              <p className="text-sm text-muted-foreground">
                {products.length === 0
                  ? "Todavía no cargaste productos. Escaneá uno y lo damos de alta en 10 segundos."
                  : "Ningún producto coincide con la búsqueda."}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 p-4 sm:grid-cols-3 xl:grid-cols-4">
            {visibles.map((p) => {
              const sinStock = p.stock <= 0;
              const poco = p.stock > 0 && p.stock <= 3;
              const color = p.color ?? "var(--muted-foreground)";
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => agregar(p)}
                  className="group flex cursor-pointer flex-col rounded-xl border border-border bg-card p-3 text-left transition-colors duration-150 hover:border-primary/60"
                >
                  <div className="flex items-start justify-between">
                    <span
                      className="grid size-10 place-items-center rounded-lg text-xl"
                      style={{
                        backgroundColor: `color-mix(in srgb, ${color} 16%, transparent)`,
                        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${color} 40%, transparent)`,
                      }}
                      aria-hidden
                    >
                      {p.emoji ?? "📦"}
                    </span>
                    {sinStock ? (
                      <span className="rounded-full bg-danger/15 px-1.5 py-0.5 text-[10px] font-semibold text-danger-ink ring-1 ring-danger/30">
                        sin stock
                      </span>
                    ) : poco ? (
                      <span className="tabular rounded-full bg-warning/15 px-1.5 py-0.5 text-[10px] font-semibold text-warning-ink ring-1 ring-warning/30">
                        quedan {p.stock}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm font-medium leading-tight">{p.name}</p>
                  <p className="tabular mt-1 text-base font-semibold">{money(p.price)}</p>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Carrito */}
      <aside className="sticky bottom-0 z-30 flex shrink-0 flex-col border-t border-border bg-card lg:top-0 lg:h-dvh lg:w-96 lg:border-l lg:border-t-0">
        <div
          className={cn(
            "items-center justify-between border-b border-border px-4 py-3.5 lg:flex",
            carrito.length > 0 ? "flex" : "hidden",
          )}
        >
          <h2 className="text-sm font-semibold">Venta actual</h2>
          {carrito.length > 0 && (
            <button
              type="button"
              onClick={() => setCarrito([])}
              className="flex cursor-pointer items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-danger-ink"
            >
              <X className="size-3.5" /> Vaciar
            </button>
          )}
        </div>

        <div
          className={cn(
            "min-h-0 flex-1 overflow-y-auto max-h-[38dvh] lg:max-h-none",
            carrito.length === 0 && "hidden lg:block",
          )}
        >
          {carrito.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              Escaneá o tocá un producto para empezar.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {carrito.map((l) => (
                <li key={l.producto.id} className="flex items-center gap-2 px-4 py-2.5">
                  <span className="text-lg" aria-hidden>
                    {l.producto.emoji ?? "📦"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{l.producto.name}</p>
                    <p className="tabular text-xs text-muted-foreground">
                      {money(l.producto.price)} c/u
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <IconBtn
                      label={`Quitar uno de ${l.producto.name}`}
                      onClick={() => cambiar(l.producto.id, -1)}
                    >
                      {l.cantidad === 1 ? (
                        <Trash2 className="size-3.5" />
                      ) : (
                        <Minus className="size-3.5" />
                      )}
                    </IconBtn>
                    <span className="tabular w-6 text-center text-sm font-semibold">
                      {l.cantidad}
                    </span>
                    <IconBtn
                      label={`Agregar uno de ${l.producto.name}`}
                      onClick={() => cambiar(l.producto.id, 1)}
                    >
                      <Plus className="size-3.5" />
                    </IconBtn>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-border p-4">
          <div className="mb-3 flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">
              Total {unidades > 0 && `· ${unidades} u.`}
            </span>
            <span className="tabular text-3xl font-semibold">{money(total)}</span>
          </div>

          <div className="mb-3 grid grid-cols-5 gap-1.5">
            {MEDIOS.map((m) => {
              const bloqueado = m.key === "account" && !canSellOnCredit;
              return (
                <button
                  key={m.key}
                  type="button"
                  disabled={bloqueado}
                  onClick={() => setMedio(m.key)}
                  aria-pressed={medio === m.key}
                  title={bloqueado ? "No tenés permiso para fiar" : undefined}
                  className={cn(
                    "flex cursor-pointer flex-col items-center gap-1 rounded-lg border px-1 py-2 text-[10px] transition-colors duration-150",
                    medio === m.key
                      ? "border-primary bg-accent text-accent-foreground"
                      : "border-border text-muted-foreground hover:text-foreground",
                    bloqueado && "cursor-not-allowed opacity-35 hover:text-muted-foreground",
                  )}
                >
                  <m.icon className="size-4" />
                  {m.label}
                </button>
              );
            })}
          </div>

          {medio === "account" && (
            <select
              value={clienteId ?? ""}
              onChange={(e) => setClienteId(e.target.value || null)}
              aria-label="Cliente al que se le fía"
              className="mb-3 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary"
            >
              <option value="">¿A quién le fiás?</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={cobrar}
            disabled={carrito.length === 0 || pending}
            className="flex h-13 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-base font-semibold text-primary-foreground transition-opacity duration-150 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {pending && <LoaderCircle className="size-4 animate-spin" />}
            {pending ? "Cobrando…" : `Cobrar ${total > 0 ? money(total) : ""}`}
          </button>
        </div>
      </aside>
    </div>
  );
}

/** Alta rápida: nombre + precio, nada más. El catálogo se arma vendiendo. */
function AltaRapida({
  barcode,
  sugerencia,
  canCreate,
  onCancel,
  onCreated,
}: {
  barcode: string | null;
  sugerencia: { nombre: string; marca: string | null } | null;
  canCreate: boolean;
  onCancel: () => void;
  onCreated: (p: { id: string; name: string; price: number }) => void;
}) {
  /* La sugerencia llega YA resuelta desde el padre: la búsqueda en el catálogo
     ocurre antes de abrir este diálogo. Así no hay estado de carga acá adentro
     ni un efecto que sincronice props con estado. */
  const [name, setName] = useState(sugerencia?.nombre ?? "");
  const [price, setPrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [delCatalogo, setDelCatalogo] = useState(!!sugerencia);
  const [pending, startTransition] = useTransition();

  function guardar() {
    startTransition(async () => {
      const res = await quickCreateProduct({
        name,
        price: Number(price),
        barcode,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onCreated({ id: res.id, name: res.name, price: res.price });
    });
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/60 sm:place-items-center">
      <div className="w-full rounded-t-2xl border border-border bg-popover p-5 sm:max-w-sm sm:rounded-2xl">
        <div className="mb-4 flex items-start gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent">
            <PackagePlus className="size-5 text-accent-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold">Producto nuevo</h2>
            <p className="text-xs text-muted-foreground">
              {barcode ? `Código ${barcode}` : "Sin código"}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancelar"
            className="cursor-pointer text-muted-foreground hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>

        {!canCreate ? (
          <p className="text-sm text-muted-foreground">
            No tenés permiso para dar de alta productos. Pedíselo al dueño.
          </p>
        ) : (
          <>
            {error && (
              <p role="alert" className="mb-3 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger-ink ring-1 ring-danger/25">
                {error}
              </p>
            )}
            <div className="space-y-3">
              {delCatalogo && (
                <p className="flex items-start gap-2 rounded-lg bg-success/10 px-3 py-2 text-sm text-success-ink ring-1 ring-success/25">
                  <Sparkles className="mt-0.5 size-4 shrink-0" />
                  Lo reconocimos. Revisá el nombre y poné tu precio.
                </p>
              )}

              <div className="space-y-1.5">
                <label htmlFor="qp-name" className="text-sm font-medium">
                  ¿Qué es?
                </label>
                <input
                  id="qp-name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setDelCatalogo(false);
                  }}
                  autoFocus={!barcode && !sugerencia}
                  placeholder="Coca-Cola 500ml"
                  className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="qp-price" className="text-sm font-medium">
                  ¿A cuánto lo vendés?
                </label>
                <input
                  id="qp-price"
                  autoFocus={!!sugerencia}
                  value={price}
                  onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ""))}
                  inputMode="numeric"
                  placeholder="1800"
                  className="tabular h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary"
                />
              </div>
              <button
                type="button"
                onClick={guardar}
                disabled={pending || !name.trim() || !price}
                className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {pending && <LoaderCircle className="size-4 animate-spin" />}
                Guardar y agregar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function IconBtn({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid size-7 cursor-pointer place-items-center rounded-md border border-border text-muted-foreground transition-colors duration-150 hover:border-primary hover:text-foreground"
    >
      {children}
    </button>
  );
}
