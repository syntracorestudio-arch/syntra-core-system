"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Search,
  Plus,
  Percent,
  Pencil,
  X,
  LoaderCircle,
  TriangleAlert,
  Archive,
  CalendarClock,
  Package,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { AvisoBanner } from "@/components/ui/aviso";
import { money } from "@/lib/format";
import { EmojiPicker } from "@/components/ui/emoji-picker";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { CategoryChips } from "@/components/ui/category-chips";
import {
  createProduct,
  updateProduct,
  archiveProduct,
  bulkReprice,
  adjustStock,
} from "./actions";

export type ProductRow = {
  id: string;
  name: string;
  emoji: string | null;
  price: number;
  cost: number | null;
  stock: number;
  lowStockThreshold: number | null;
  categoryId: string | null;
};

export type CategoryRow = { id: string; name: string; emoji: string | null; color: string | null };

type Aviso = { tone: "ok" | "error"; text: string } | null;

/** Mismos atajos que en el ingreso: el caso frecuente en un toque. */
const ATAJOS_VENC = [
  { label: "1 semana", dias: 7 },
  { label: "15 días", dias: 15 },
  { label: "1 mes", dias: 30 },
] as const;

/** Normaliza para comparar: sin acentos, sin mayúsculas, sin espacios de más. */
function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Busca productos parecidos al nombre que se está escribiendo.
 *
 * Duplicar un producto es peor de lo que parece: parte el stock en dos fichas
 * (ninguna refleja la góndola), rompe las alertas de stock bajo y hace que el
 * producto compita consigo mismo en los reportes.
 *
 * Coincide si uno contiene al otro o si comparten las dos primeras palabras
 * ("Agua Villa 1.5L" ↔ "Agua Villa 500ml"): son casos que vale marcar aunque
 * después resulten productos distintos.
 */
function buscarParecidos(nombre: string, productos: ProductRow[]): ProductRow[] {
  const q = normalizar(nombre);
  if (q.length < 3) return [];

  const palabras = q.split(" ");
  const raiz = palabras.slice(0, 2).join(" ");

  return productos
    .filter((p) => {
      const n = normalizar(p.name);
      if (n === q) return true;
      if (n.includes(q) || q.includes(n)) return true;
      return raiz.length >= 5 && n.startsWith(raiz);
    })
    .slice(0, 3);
}

function enDias(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Margen sobre el precio de venta. Null si falta el costo: preferimos no mostrar
 *  nada antes que mostrar un número que miente (business-rules §2). */
function margen(price: number, cost: number | null): number | null {
  if (cost === null || price <= 0) return null;
  return ((price - cost) / price) * 100;
}

export function ProductsClient({
  products,
  categories,
  defaultThreshold,
}: {
  products: ProductRow[];
  categories: CategoryRow[];
  defaultThreshold: number;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [editando, setEditando] = useState<ProductRow | null>(null);
  const [creando, setCreando] = useState(false);
  const [remarcando, setRemarcando] = useState(false);
  const [aviso, setAviso] = useState<Aviso>(null);

  /* El filtro de categoría vive en la URL (?cat=): volver atrás o refrescar
     respeta lo que estabas mirando, y un link a "Productos > Bebidas" se puede
     compartir. replace y no push: cambiar de chip no debe apilar historial. */
  const router = useRouter();
  const searchParams = useSearchParams();
  const cat = searchParams.get("cat");
  const setCat = (id: string | null) => {
    const params = new URLSearchParams(searchParams);
    if (id) params.set("cat", id);
    else params.delete("cat");
    router.replace(`/admin/productos${params.size ? `?${params}` : ""}`, { scroll: false });
  };

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    let base = products;
    if (cat) base = base.filter((p) => p.categoryId === cat);
    if (!q) return base;
    return base.filter((p) => p.name.toLowerCase().includes(q));
  }, [busqueda, cat, products]);

  const sinCosto = products.filter((p) => p.cost === null).length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8 lg:py-8">
      <div className="mb-5">
        <PageHeader
          title="Productos"
          subtitle={`${products.length} activos${sinCosto > 0 ? ` · ${sinCosto} sin costo cargado` : ""}`}
          icon={Package}
        >
          <Button variant="secondary" className="bg-background/60" onClick={() => setRemarcando(true)}>
            <Percent className="size-4" /> Remarcar
          </Button>
          <Button variant="primary" onClick={() => setCreando(true)}>
            <Plus className="size-4" /> Nuevo
          </Button>
        </PageHeader>
      </div>

      <AvisoBanner aviso={aviso} onClose={() => setAviso(null)} />

      <CategoryChips categories={categories} value={cat} onChange={setCat} className="mb-3" />

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar producto"
          aria-label="Buscar producto"
          className="h-11 w-full rounded-lg border border-input bg-card pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
        />
      </div>

      <ul className="divide-y divide-border rounded-xl border border-border bg-card">
        {visibles.map((p) => {
          const m = margen(p.price, p.cost);
          const umbral = p.lowStockThreshold ?? defaultThreshold;
          const bajo = p.stock <= umbral;
          return (
            <li key={p.id} className="flex items-center gap-3 px-4 py-3">
              {/* Chip y no emoji suelto: la fila pasa de "texto con dibujito" a
                  fila compuesta (V5). El emoji sigue siendo la identidad que
                  elige el kiosquero. */}
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary text-lg" aria-hidden>
                {p.emoji ?? "📦"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{p.name}</p>
                <p className="tabular text-xs text-muted-foreground">
                  {money(p.price)}
                  {m !== null ? (
                    <span className="text-success-ink"> · {m.toFixed(0)}% margen</span>
                  ) : (
                    <span className="text-warning-ink"> · sin costo</span>
                  )}
                </p>
              </div>
              <span
                className={cn(
                  "tabular shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold",
                  bajo
                    ? "bg-warning/15 text-warning-ink ring-1 ring-warning/30"
                    : "text-muted-foreground",
                )}
              >
                {p.stock} u.
              </span>
              <button
                type="button"
                onClick={() => setEditando(p)}
                aria-label={`Editar ${p.name}`}
                className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-md border border-border text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
              >
                <Pencil className="size-3.5" />
              </button>
            </li>
          );
        })}
        {visibles.length === 0 && (
          <li className="px-4 py-10 text-center text-sm text-muted-foreground">
            No hay productos que coincidan.
          </li>
        )}
      </ul>

      {remarcando && (
        <RepriceDialog
          categories={categories}
          products={products}
          onClose={() => setRemarcando(false)}
          onDone={(n) => {
            setRemarcando(false);
            setAviso({ tone: "ok", text: `Remarcaste ${n} producto${n === 1 ? "" : "s"}.` });
          }}
          onError={(e) => setAviso({ tone: "error", text: e })}
        />
      )}

      {(editando || creando) && (
        <ProductDialog
          product={editando}
          categories={categories}
          existentes={products}
          onClose={() => {
            setEditando(null);
            setCreando(false);
          }}
          onDone={(msg) => {
            setEditando(null);
            setCreando(false);
            setAviso({ tone: "ok", text: msg });
          }}
          onError={(e) => setAviso({ tone: "error", text: e })}
        />
      )}
    </div>
  );
}

/** Remarcado masivo con PREVIEW: nadie toca los precios de todo su negocio a ciegas. */
function RepriceDialog({
  categories,
  products,
  onClose,
  onDone,
  onError,
}: {
  categories: CategoryRow[];
  products: ProductRow[];
  onClose: () => void;
  onDone: (count: number) => void;
  onError: (msg: string) => void;
}) {
  const [pct, setPct] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const n = Number(pct);
  const valido = pct !== "" && !Number.isNaN(n) && n !== 0;

  const alcance = categoryId ? products.filter((p) => p.categoryId === categoryId) : products;
  const preview = alcance.slice(0, 4).map((p) => ({
    name: p.name,
    antes: p.price,
    // Mismo redondeo que la RPC (múltiplo de $50 hacia arriba) para que lo que
    // ve el dueño sea lo que va a pasar.
    despues: valido ? Math.ceil((p.price * (1 + n / 100)) / 50) * 50 : p.price,
  }));

  function aplicar() {
    startTransition(async () => {
      const res = await bulkReprice({ pct: n, category_id: categoryId });
      if (!res.ok) {
        onError(res.error);
        return;
      }
      onDone(res.count);
    });
  }

  return (
    <Dialog title="Remarcar precios" onClose={onClose}>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="rp-scope" className="text-sm font-medium">
            ¿Qué remarcás?
          </label>
          <select
            id="rp-scope"
            value={categoryId ?? ""}
            onChange={(e) => setCategoryId(e.target.value || null)}
            className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary"
          >
            <option value="">Todo el catálogo ({products.length})</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.emoji} {c.name} ({products.filter((p) => p.categoryId === c.id).length})
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="rp-pct" className="text-sm font-medium">
            ¿Cuánto? (%)
          </label>
          <input
            id="rp-pct"
            value={pct}
            onChange={(e) => setPct(e.target.value.replace(/[^\d.-]/g, ""))}
            inputMode="decimal"
            autoFocus
            placeholder="12.5"
            className="tabular h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary"
          />
          <p className="text-xs text-muted-foreground">
            Poné un número negativo para bajar precios. Se redondea a $50 hacia arriba.
          </p>
        </div>

        {valido && preview.length > 0 && (
          <div className="rounded-lg border border-border bg-background p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Así van a quedar</p>
            <ul className="space-y-1.5">
              {preview.map((p) => (
                <li key={p.name} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  <span className="tabular shrink-0 text-muted-foreground line-through">
                    {money(p.antes)}
                  </span>
                  <span className="tabular shrink-0 font-semibold">{money(p.despues)}</span>
                </li>
              ))}
            </ul>
            {alcance.length > preview.length && (
              <p className="mt-2 text-xs text-muted-foreground">
                y {alcance.length - preview.length} más
              </p>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={aplicar}
          disabled={!valido || pending || alcance.length === 0}
          className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {pending && <LoaderCircle className="size-4 animate-spin" />}
          Remarcar {alcance.length} producto{alcance.length === 1 ? "" : "s"}
        </button>
      </div>
    </Dialog>
  );
}

function ProductDialog({
  product,
  categories,
  existentes,
  onClose,
  onDone,
  onError,
}: {
  product: ProductRow | null;
  categories: CategoryRow[];
  existentes: ProductRow[];
  onClose: () => void;
  onDone: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [name, setName] = useState(product?.name ?? "");
  const [emoji, setEmoji] = useState(product?.emoji ?? "");
  const [price, setPrice] = useState(product ? String(product.price) : "");
  const [cost, setCost] = useState(product?.cost != null ? String(product.cost) : "");
  const [categoryId, setCategoryId] = useState<string | null>(product?.categoryId ?? null);
  const [threshold, setThreshold] = useState(
    product?.lowStockThreshold != null ? String(product.lowStockThreshold) : "",
  );
  const [stockInicial, setStockInicial] = useState("");
  const [vence, setVence] = useState("");
  const [barcode, setBarcode] = useState("");
  const [ajuste, setAjuste] = useState("");
  const [ignorarDup, setIgnorarDup] = useState(false);
  const [pending, startTransition] = useTransition();

  const m = margen(Number(price) || 0, cost === "" ? null : Number(cost));

  // Solo al crear: al editar, el propio producto siempre "coincide" consigo mismo.
  const parecidos = useMemo(
    () => (product ? [] : buscarParecidos(name, existentes)),
    [name, existentes, product],
  );
  const hayDuplicado = parecidos.length > 0 && !ignorarDup;

  function guardar() {
    startTransition(async () => {
      const base = {
        name,
        price: Number(price) || 0,
        cost: cost === "" ? null : Number(cost),
        emoji: emoji || null,
        category_id: categoryId,
        low_stock_threshold: threshold === "" ? null : Number(threshold),
      };
      const res = product
        ? await updateProduct(product.id, base)
        : await createProduct({
            ...base,
            initial_stock: stockInicial === "" ? null : Number(stockInicial),
            expiry_date: vence || null,
            barcode: barcode.trim() || null,
          });
      if (!res.ok) {
        onError(res.error);
        return;
      }
      onDone(product ? "Producto actualizado." : "Producto creado.");
    });
  }

  function aplicarAjuste() {
    if (!product) return;
    const delta = Number(ajuste);
    if (!delta) return;
    startTransition(async () => {
      const res = await adjustStock(product.id, delta, delta < 0 ? "waste" : "adjust", "ajuste manual");
      if (!res.ok) {
        onError(res.error);
        return;
      }
      onDone("Stock ajustado.");
    });
  }

  return (
    <Dialog title={product ? "Editar producto" : "Producto nuevo"} onClose={onClose}>
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="w-20 space-y-1.5">
            <span className="block text-sm font-medium">Ícono</span>
            <EmojiPicker value={emoji} onChange={setEmoji} />
          </div>
          <div className="flex-1 space-y-1.5">
            <label htmlFor="pd-name" className="text-sm font-medium">
              Nombre
            </label>
            <input
              id="pd-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setIgnorarDup(false);
              }}
              className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary"
            />
          </div>
        </div>

        {/* Aviso de duplicado: NO bloquea. "Agua Villa 500ml" y "Agua Villa 1.5L"
            son productos distintos con nombre casi igual — la decisión es del
            dueño, igual que con el límite de fiado. */}
        {hayDuplicado && (
          <div className="rounded-lg bg-warning/10 px-3 py-2.5 text-sm ring-1 ring-warning/25">
            <p className="flex items-start gap-2 font-medium text-warning-ink">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              {parecidos.length === 1 ? "Ya tenés algo parecido" : "Ya tenés productos parecidos"}
            </p>
            <ul className="mt-2 space-y-1.5">
              {parecidos.map((p) => (
                <li key={p.id} className="flex items-center gap-2">
                  <span aria-hidden>{p.emoji ?? "📦"}</span>
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  <span className="tabular shrink-0 text-xs text-muted-foreground">
                    {p.stock}u · {money(p.price)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {/* Si es el mismo producto, lo que quiere no es crearlo: es sumarle
                  stock. Y ahí el sistema YA sabe cuánto tiene. */}
              <Link
                href="/admin/ingreso"
                className="flex h-8 cursor-pointer items-center rounded-lg bg-primary px-2.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                Es el mismo: cargarle stock
              </Link>
              <button
                type="button"
                onClick={() => setIgnorarDup(true)}
                className="h-8 cursor-pointer rounded-lg border border-border px-2.5 text-xs font-medium transition-colors hover:border-primary"
              >
                Es otro producto
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <div className="flex-1 space-y-1.5">
            <label htmlFor="pd-price" className="text-sm font-medium">
              ¿A cuánto lo vendés?
            </label>
            <input
              id="pd-price"
              value={price}
              onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ""))}
              inputMode="numeric"
              placeholder="1800"
              className="tabular h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary"
            />
          </div>
          <div className="flex-1 space-y-1.5">
            <label htmlFor="pd-cost" className="text-sm font-medium">
              ¿Cuánto te cuesta?
            </label>
            <input
              id="pd-cost"
              value={cost}
              onChange={(e) => setCost(e.target.value.replace(/[^\d]/g, ""))}
              inputMode="numeric"
              placeholder="opcional"
              className="tabular h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary"
            />
          </div>
        </div>

        {m === null ? (
          <p className="text-xs text-muted-foreground">
            Cargá el costo y te calculamos cuánto ganás con cada uno.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Ganás{" "}
            <span className="tabular font-semibold text-success-ink">
              {money((Number(price) || 0) - Number(cost))} por unidad
            </span>{" "}
            · margen {m.toFixed(0)}%
          </p>
        )}

        <div className="space-y-1.5">
          <label htmlFor="pd-cat" className="text-sm font-medium">
            Categoría
          </label>
          <select
            id="pd-cat"
            value={categoryId ?? ""}
            onChange={(e) => setCategoryId(e.target.value || null)}
            className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary"
          >
            <option value="">Sin categoría</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.emoji} {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Antes decía "Avisar en", que no dice QUÉ se avisa. La etiqueta ahora es
            la frase completa y el número va en el medio. */}
        <div className="space-y-1.5">
          <label htmlFor="pd-thr" className="text-sm font-medium">
            Avisarme cuando queden pocos
          </label>
          <div className="flex items-center gap-2">
            <input
              id="pd-thr"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value.replace(/[^\d]/g, ""))}
              inputMode="numeric"
              placeholder="3"
              className="tabular h-11 w-20 rounded-lg border border-input bg-background px-3 text-center text-sm outline-none focus:border-primary"
            />
            <span className="text-sm text-muted-foreground">unidades o menos</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Si lo dejás vacío usamos el número de tus Ajustes.
          </p>
        </div>

        {/* Solo al CREAR: quien carga un producto nuevo lo tiene en la mano.
            Obligarlo a crearlo en cero y después ir a Ingreso es doble trabajo. */}
        {!product && (
          <div className="space-y-3 rounded-lg border border-border bg-background p-3">
            <div className="space-y-1.5">
              <label htmlFor="pd-barcode" className="text-sm font-medium">
                Código de barras
              </label>
              <input
                id="pd-barcode"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value.replace(/[^\d]/g, ""))}
                inputMode="numeric"
                placeholder="Escaneá o escribilo (opcional)"
                className="tabular h-11 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
              />
              <p className="text-xs text-muted-foreground">
                Con el código lo encontrás escaneando en la caja.
              </p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="pd-stock" className="text-sm font-medium">
                ¿Cuántos tenés ahora?
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="pd-stock"
                  value={stockInicial}
                  onChange={(e) => setStockInicial(e.target.value.replace(/[^\d]/g, ""))}
                  inputMode="numeric"
                  placeholder="0"
                  className="tabular h-11 w-24 rounded-lg border border-input bg-card px-3 text-center text-sm outline-none focus:border-primary"
                />
                <span className="text-sm text-muted-foreground">en la góndola</span>
              </div>
              {/* El sistema no tiene forma de saberlo: no hay sensor en la
                  góndola. Decirlo es mejor que dejar la duda. */}
              <p className="text-xs text-muted-foreground">
                Contalos una sola vez: desde acá el stock se descuenta solo con
                cada venta.
              </p>
            </div>

            {Number(stockInicial) > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <CalendarClock className="size-3.5 text-muted-foreground" />
                  <span className="text-sm font-medium">¿Vence pronto? Te aviso antes</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {ATAJOS_VENC.map((a) => {
                    const valor = enDias(a.dias);
                    const activo = vence === valor;
                    return (
                      <button
                        key={a.label}
                        type="button"
                        onClick={() => setVence(activo ? "" : valor)}
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
                    type="date"
                    value={vence}
                    onChange={(e) => setVence(e.target.value)}
                    aria-label="Fecha de vencimiento"
                    className="h-9 min-w-[8.5rem] flex-1 rounded-lg border border-input bg-card px-2 text-xs outline-none focus:border-primary"
                  />
                </div>
                {vence && (
                  <p className="text-xs text-success-ink">Te aviso antes del {vence}</p>
                )}
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={guardar}
          disabled={pending || !name.trim()}
          className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {pending && <LoaderCircle className="size-4 animate-spin" />}
          Guardar
        </button>

        {product && (
          <div className="space-y-2 border-t border-border pt-3">
            <p className="text-xs font-medium text-muted-foreground">
              Stock actual: <span className="tabular font-semibold text-foreground">{product.stock} u.</span>
            </p>
            <div className="flex gap-2">
              <input
                value={ajuste}
                onChange={(e) => setAjuste(e.target.value.replace(/[^\d-]/g, ""))}
                inputMode="numeric"
                placeholder="+10 o -3"
                aria-label="Ajuste de stock"
                className="tabular h-10 flex-1 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary"
              />
              <button
                type="button"
                onClick={aplicarAjuste}
                disabled={pending || !ajuste}
                className="h-10 cursor-pointer rounded-lg border border-border px-3 text-sm font-medium transition-colors hover:border-primary disabled:opacity-40"
              >
                Ajustar
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              El ajuste queda asentado. Un número negativo se registra como merma.
            </p>

            <button
              type="button"
              onClick={() =>
                startTransition(async () => {
                  const res = await archiveProduct(product.id);
                  if (!res.ok) onError(res.error);
                  else onDone("Producto archivado.");
                })
              }
              disabled={pending}
              className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-danger-ink"
            >
              <Archive className="size-3.5" /> Archivar producto
            </button>
          </div>
        )}
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
    <div className="fixed inset-0 z-50 grid place-items-end overflow-y-auto bg-black/60 p-0 sm:place-items-center sm:p-4">
      <div className="w-full rounded-t-2xl border border-border bg-popover p-5 sm:max-w-md sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="cursor-pointer text-muted-foreground hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
