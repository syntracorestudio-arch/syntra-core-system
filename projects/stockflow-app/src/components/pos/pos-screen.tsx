"use client";

import { useMemo, useState } from "react";
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
} from "lucide-react";
import { cn } from "@/lib/cn";
import { money } from "@/lib/format";

/**
 * POS — la pantalla reina. Criterio de aceptación del PRD: 3 productos cobrados
 * en menos de 15 s, menos de 300 ms por ítem.
 *
 * TANDA 1A: catálogo fixture + carrito en estado local, para validar la dirección
 * visual y el ritmo de la interacción. En 1D se cablea el escáner real
 * (lector USB keyboard-wedge + cámara con BarcodeDetector) y en 1C la RPC atómica
 * `register_sale`, que es la única vía de escritura.
 */

type Producto = {
  id: string;
  nombre: string;
  emoji: string;
  precio: number;
  categoria: keyof typeof CATEGORIAS;
  stock: number;
};

const CATEGORIAS = {
  bebidas: { label: "Bebidas", color: "var(--cat-bebidas)" },
  golosinas: { label: "Golosinas", color: "var(--cat-golosinas)" },
  cigarrillos: { label: "Cigarrillos", color: "var(--cat-cigarrillos)" },
  almacen: { label: "Almacén", color: "var(--cat-almacen)" },
  limpieza: { label: "Limpieza", color: "var(--cat-limpieza)" },
  fiambres: { label: "Fiambres", color: "var(--cat-fiambres)" },
  panaderia: { label: "Panadería", color: "var(--cat-panaderia)" },
  varios: { label: "Varios", color: "var(--cat-varios)" },
} as const;

const CATALOGO: Producto[] = [
  { id: "1", nombre: "Coca-Cola 500ml", emoji: "🥤", precio: 1800, categoria: "bebidas", stock: 3 },
  { id: "2", nombre: "Agua Villa 1.5L", emoji: "💧", precio: 1500, categoria: "bebidas", stock: 24 },
  { id: "3", nombre: "Cerveza Quilmes", emoji: "🍺", precio: 2900, categoria: "bebidas", stock: 18 },
  { id: "4", nombre: "Alfajor Jorgito", emoji: "🍫", precio: 900, categoria: "golosinas", stock: 42 },
  { id: "5", nombre: "Chicles Beldent", emoji: "🍬", precio: 700, categoria: "golosinas", stock: 30 },
  { id: "6", nombre: "Marlboro box", emoji: "🚬", precio: 4500, categoria: "cigarrillos", stock: 2 },
  { id: "7", nombre: "Papas Lays", emoji: "🥔", precio: 2400, categoria: "almacen", stock: 15 },
  { id: "8", nombre: "Yerba Playadito 1k", emoji: "🧉", precio: 5200, categoria: "almacen", stock: 9 },
  { id: "9", nombre: "Jabón Ala 800ml", emoji: "🧼", precio: 3100, categoria: "limpieza", stock: 7 },
  { id: "10", nombre: "Jamón cocido 100g", emoji: "🥓", precio: 2800, categoria: "fiambres", stock: 5 },
  { id: "11", nombre: "Pan lactal", emoji: "🍞", precio: 2600, categoria: "panaderia", stock: 4 },
  { id: "12", nombre: "Pilas AA x2", emoji: "🔋", precio: 3400, categoria: "varios", stock: 11 },
];

const MEDIOS = [
  { key: "cash", label: "Efectivo", icon: Banknote },
  { key: "qr", label: "QR", icon: QrCode },
  { key: "card", label: "Tarjeta", icon: CreditCard },
  { key: "transfer", label: "Transfer.", icon: ArrowRightLeft },
  { key: "account", label: "Fiado", icon: UserRound },
] as const;

type Linea = { producto: Producto; cantidad: number };

export function PosScreen() {
  const [busqueda, setBusqueda] = useState("");
  const [carrito, setCarrito] = useState<Linea[]>([]);
  const [medio, setMedio] = useState<(typeof MEDIOS)[number]["key"]>("cash");

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return CATALOGO;
    return CATALOGO.filter((p) => p.nombre.toLowerCase().includes(q));
  }, [busqueda]);

  const total = carrito.reduce((a, l) => a + l.producto.precio * l.cantidad, 0);
  const unidades = carrito.reduce((a, l) => a + l.cantidad, 0);

  function agregar(producto: Producto) {
    setCarrito((prev) => {
      const existente = prev.find((l) => l.producto.id === producto.id);
      if (existente) {
        return prev.map((l) =>
          l.producto.id === producto.id ? { ...l, cantidad: l.cantidad + 1 } : l,
        );
      }
      return [...prev, { producto, cantidad: 1 }];
    });
  }

  function cambiar(id: string, delta: number) {
    setCarrito((prev) =>
      prev
        .map((l) => (l.producto.id === id ? { ...l, cantidad: l.cantidad + delta } : l))
        .filter((l) => l.cantidad > 0),
    );
  }

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      {/* Catálogo */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
          <div className="flex items-center gap-2">
            {/* Salida del POS: el dueño vende y vuelve a su panel. Para el empleado
                /pos es su home y este link no se muestra (permisos, tanda 1B). */}
            <Link
              href="/admin"
              aria-label="Volver al resumen"
              className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-lg border border-border text-muted-foreground transition-colors duration-150 hover:text-foreground"
            >
              <ArrowLeft className="size-5" />
            </Link>
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
              aria-label="Escanear con la cámara"
              className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-lg bg-primary text-primary-foreground transition-opacity duration-150 hover:opacity-90"
            >
              <ScanBarcode className="size-5" />
            </button>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-2.5 p-4 sm:grid-cols-3 xl:grid-cols-4">
          {visibles.map((p) => {
            const cat = CATEGORIAS[p.categoria];
            const sinStock = p.stock <= 0;
            const poco = p.stock > 0 && p.stock <= 3;
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
                      backgroundColor: `color-mix(in srgb, ${cat.color} 16%, transparent)`,
                      boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${cat.color} 40%, transparent)`,
                    }}
                    aria-hidden
                  >
                    {p.emoji}
                  </span>
                  {/* a11y: el estado lleva texto, no solo color */}
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
                <p className="mt-2 line-clamp-2 text-sm font-medium leading-tight">{p.nombre}</p>
                <p className="tabular mt-1 text-base font-semibold">{money(p.precio)}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Carrito */}
      <aside className="sticky bottom-0 z-30 flex shrink-0 flex-col border-t border-border bg-card lg:top-0 lg:h-dvh lg:w-96 lg:border-l lg:border-t-0">
        {/* En mobile el encabezado aparece recién cuando hay algo cargado: la caja
            no debe gastar alto de pantalla en un título vacío. */}
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

        {/* El cajero TIENE que ver lo que cargó, también en el teléfono. En mobile la
            lista se acota a ~38dvh para no tapar el catálogo. */}
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
                    {l.producto.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{l.producto.nombre}</p>
                    <p className="tabular text-xs text-muted-foreground">
                      {money(l.producto.precio)} c/u
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <IconBtn
                      label={`Quitar uno de ${l.producto.nombre}`}
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
                      label={`Agregar uno de ${l.producto.nombre}`}
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
            {MEDIOS.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setMedio(m.key)}
                aria-pressed={medio === m.key}
                className={cn(
                  "flex cursor-pointer flex-col items-center gap-1 rounded-lg border px-1 py-2 text-[10px] transition-colors duration-150",
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

          <button
            type="button"
            disabled={carrito.length === 0}
            className="h-13 w-full cursor-pointer rounded-xl bg-primary py-3.5 text-base font-semibold text-primary-foreground transition-opacity duration-150 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Cobrar {total > 0 && money(total)}
          </button>
        </div>
      </aside>
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
