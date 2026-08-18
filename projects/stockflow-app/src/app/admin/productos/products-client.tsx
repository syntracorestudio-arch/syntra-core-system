"use client";

import { useMemo, useState, useTransition, useEffect, useRef } from "react";
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
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  Check,
  ListChecks,
  PackageSearch,
  FileSpreadsheet,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { AvisoBanner } from "@/components/ui/aviso";
import { money } from "@/lib/format";
import { EmojiPicker } from "@/components/ui/emoji-picker";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { CategoryChips, SIN_CATEGORIA } from "@/components/ui/category-chips";
import {
  createProduct,
  updateProduct,
  archiveProduct,
  bulkReprice,
  bulkAssignCategory,
  adjustStock,
  marcarStockContado,
} from "./actions";
import { buscarProductos, type ProductoBuscado } from "@/app/pos/actions";
import { ImportDialog } from "./import-dialog";

export type ProductRow = {
  id: string;
  name: string;
  emoji: string | null;
  price: number;
  cost: number | null;
  stock: number;
  lowStockThreshold: number | null;
  categoryId: string | null;
  /** ¿Alguien contó la góndola? false = se vende, pero sin avisos de faltante. */
  stockConfiable?: boolean;
  /** Días que dura el stock al ritmo de los últimos 30 días. `null` = sin ventas. */
  diasCobertura: number | null;
};

export type CategoryRow = {
  id: string;
  name: string;
  emoji: string | null;
  color: string | null;
  /** Contador real de productos activos (de categorias_resumen). */
  count?: number;
  /** Señales de salud por categoría (de categorias_resumen): alimentan el índice. */
  stockBajo?: number;
  sinCosto?: number;
};

/* Con pocos productos el índice de categorías es burocracia: una lista plana se
   recorre entera de un vistazo. El drill-down recién paga con volumen. Umbral
   ajustable (audit §C3); 40 ≈ lo que entra en 2-3 pantallas de scroll. */
const UMBRAL_DRILLDOWN = 40;

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
  totalFiltradoInicial,
  initialQ,
  categories,
  sinCategoria,
  sinControlStock = 0,
  soloSinControl = false,
  defaultThreshold,
  totalProductos,
  margenDefault,
  redondeo,
}: {
  products: ProductRow[];
  /** Total real del filtro con el que se sirvió la primera página (?cat/?q). */
  totalFiltradoInicial: number;
  /** ?q= de la URL: refrescar una búsqueda tiene que devolver ESA búsqueda. */
  initialQ: string;
  categories: CategoryRow[];
  /** Productos sin categoría (la deuda del catálogo): habilita su filtro. */
  sinCategoria: number;
  /** Productos que se venden pero nadie contó todavía (puesta en marcha, 038). */
  sinControlStock?: number;
  /** ¿Estamos viendo justamente esa lista? (`?control=sin`) */
  soloSinControl?: boolean;
  defaultThreshold: number;
  /** Total REAL de activos: el listado viene acotado a 500 (escala Fase 1). */
  totalProductos: number;
  /** Margen del negocio: propone el precio cuando la planilla solo trae costo. */
  margenDefault: number;
  redondeo: number;
}) {
  const [busqueda, setBusqueda] = useState(initialQ);
  const [editando, setEditando] = useState<ProductRow | null>(null);
  const [creando, setCreando] = useState(false);
  const [remarcando, setRemarcando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [aviso, setAviso] = useState<Aviso>(null);

  /* El filtro de categoría vive en la URL (?cat=): volver atrás o refrescar
     respeta lo que estabas mirando, y un link a "Productos > Bebidas" se puede
     compartir. history API y no router.push: los datos ya los trae el fetch de
     abajo — repetir el render del server component por cada filtro es pagar la
     misma consulta dos veces (Next mantiene useSearchParams en sync igual).
     push SOLO al entrar a una categoría desde el índice: así el botón "atrás"
     del teléfono vuelve al índice, que es lo que cualquiera espera. */
  const searchParams = useSearchParams();
  const cat = searchParams.get("cat");
  const setCat = (id: string | null, opts?: { push?: boolean }) => {
    const params = new URLSearchParams(searchParams);
    if (id) params.set("cat", id);
    else params.delete("cat");
    const url = `/admin/productos${params.size ? `?${params}` : ""}`;
    if (opts?.push) window.history.pushState(null, "", url);
    else window.history.replaceState(null, "", url);
  };

  /* ESCALA FASE 2 — la lista dejó de filtrarse en memoria sobre un precargado de 500.
     `filas` arranca con la primera página que vino del server component y se
     re-consulta cuando cambia la búsqueda o la categoría (con debounce). "Cargar más"
     pide la página siguiente. `totalFiltrado` es el conteo REAL del filtro actual. */
  const [filas, setFilas] = useState<ProductRow[]>(products);
  const [totalFiltrado, setTotalFiltrado] = useState(totalFiltradoInicial);
  const [cargando, setCargando] = useState(false);
  const [cargandoMas, setCargandoMas] = useState(false);
  const primeraCarga = useRef(true);

  const mapear = (items: ProductoBuscado[]): ProductRow[] =>
    items.map((p) => {
      const porDia = p.sold30d / 30;
      return {
        id: p.id,
        name: p.name,
        emoji: p.emoji,
        price: p.price,
        cost: p.cost,
        stock: p.stock,
        lowStockThreshold: p.lowStockThreshold,
        categoryId: p.categoryId,
        stockConfiable: p.stockConfiable,
        diasCobertura: porDia > 0 ? Math.floor(p.stock / porDia) : null,
      };
    });

  useEffect(() => {
    // La primera página ya la trajo el server component: no re-consultar al montar.
    if (primeraCarga.current) {
      primeraCarga.current = false;
      return;
    }
    let vivo = true;
    const t = setTimeout(() => {
      // La búsqueda también vive en la URL (?q=), con replace: cada tecla no es
      // una página del historial, pero refrescar/compartir conserva la búsqueda.
      const params = new URLSearchParams(window.location.search);
      if (busqueda.trim()) params.set("q", busqueda.trim());
      else params.delete("q");
      window.history.replaceState(null, "", `/admin/productos${params.size ? `?${params}` : ""}`);

      setCargando(true);
      buscarProductos({ q: busqueda.trim() || null, categoria: cat, soloSinControl, limit: 50, offset: 0 })
        .then((r) => {
          if (!vivo) return;
          setFilas(mapear(r.items));
          setTotalFiltrado(r.total);
        })
        .catch(() => vivo && setFilas([]))
        .finally(() => vivo && setCargando(false));
    }, 200);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [busqueda, cat, soloSinControl]);

  function cargarMas() {
    setCargandoMas(true);
    buscarProductos({ q: busqueda.trim() || null, categoria: cat, soloSinControl, limit: 50, offset: filas.length })
      .then((r) => {
        setFilas((prev) => [...prev, ...mapear(r.items)]);
        setTotalFiltrado(r.total);
      })
      .catch(() => {})
      .finally(() => setCargandoMas(false));
  }

  const visibles = filas;
  const hayMas = filas.length < totalFiltrado;

  /* DRILL-DOWN (audit §C3) — tres niveles con la URL como estado:
     Nivel 0 = índice de categorías (portada con catálogo grande) · Nivel 1 =
     lista de la categoría activa (?cat=) · Nivel 2 = la ficha de siempre.
     Buscar corta camino desde cualquier nivel: resultados planos con su
     categoría a la vista. Con catálogo chico nada de esto aparece. */
  const q = busqueda.trim();
  const drilldown = totalProductos > UMBRAL_DRILLDOWN;
  // Con `?control=sin` el usuario ya eligió QUÉ mirar: mostrar el índice sería
  // hacerle elegir de nuevo.
  const enIndice = drilldown && !cat && !q && !soloSinControl;
  const catActiva = cat && cat !== SIN_CATEGORIA ? categories.find((c) => c.id === cat) : null;
  const catPorId = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  // Tag de categoría por fila solo cuando la lista NO está ya acotada a una:
  // en resultados de búsqueda ubica; dentro de "Bebidas" sería ruido.
  const mostrarCatEnFila = !cat;

  /* CATEGORIZAR EN MASA — la deuda "Sin categoría" se salda seleccionando y
     moviendo de a tandas, no abriendo 200 fichas. `null` = modo normal; un Set
     vacío = seleccionando. La selección sobrevive al cambio de filtro a
     propósito: podés juntar productos de varias vistas y moverlos juntos. */
  const router = useRouter();
  const [seleccion, setSeleccion] = useState<Set<string> | null>(null);
  const [moviendo, setMoviendo] = useState(false);
  const [aplicandoMover, setAplicandoMover] = useState(false);

  const toggleSeleccion = (id: string) =>
    setSeleccion((prev) => {
      if (!prev) return prev;
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  function aplicarMover(categoryId: string | null, nombre: string | null) {
    const ids = [...(seleccion ?? [])];
    if (ids.length === 0) return;
    setAplicandoMover(true);
    (async () => {
      // La action acota a 500 por llamada: selecciones más grandes van en tandas.
      let total = 0;
      for (let i = 0; i < ids.length; i += 500) {
        const res = await bulkAssignCategory({
          product_ids: ids.slice(i, i + 500),
          category_id: categoryId,
        });
        if (!res.ok) {
          setAplicandoMover(false);
          setAviso({ tone: "error", text: res.error });
          return;
        }
        total += res.count;
      }
      setAplicandoMover(false);
      setMoviendo(false);
      setSeleccion(null);
      setAviso({
        tone: "ok",
        text: nombre
          ? `Movimos ${total} producto${total === 1 ? "" : "s"} a ${nombre}.`
          : `Le quitamos la categoría a ${total} producto${total === 1 ? "" : "s"}.`,
      });
      // Doble refresco: el server component (contadores del índice/chips) y la
      // página visible de la lista (que es estado del cliente).
      router.refresh();
      buscarProductos({ q: busqueda.trim() || null, categoria: cat, soloSinControl, limit: 50, offset: 0 })
        .then((r) => {
          setFilas(mapear(r.items));
          setTotalFiltrado(r.total);
        })
        .catch(() => {});
    })();
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8 lg:py-8">
      <div className="mb-5">
        <PageHeader
          title="Productos"
          /* El total REAL del catálogo, y cuando hay un filtro activo, cuántos
             coinciden. Ya no se cuenta "sin costo" acá: con paginación server-side
             ese número solo podría calcularse sobre la página visible, y un conteo
             parcial presentado como total es exactamente lo que Fase 1 vino a sacar.
             El dato completo vive en Reportes → salud de datos. */
          subtitle={
            busqueda.trim() || cat
              ? `${totalFiltrado} de ${totalProductos} productos`
              : `${totalProductos} activos`
          }
          icon={Package}
          art="productos"
        >
          <Button variant="secondary" className="bg-background/60" onClick={() => setImportando(true)}>
            <FileSpreadsheet className="size-4" /> Importar
          </Button>
          <Button variant="secondary" className="bg-background/60" onClick={() => setRemarcando(true)}>
            <Percent className="size-4" /> Remarcar
          </Button>
          <Button variant="primary" onClick={() => setCreando(true)}>
            <Plus className="size-4" /> Nuevo
          </Button>
        </PageHeader>
      </div>

      <AvisoBanner aviso={aviso} onClose={() => setAviso(null)} />

      {/* Catálogo chico: chips + lista plana, todo entra de un vistazo. Catálogo
          grande: manda el índice del drill-down y los chips sobran. */}
      {!drilldown && (
        <CategoryChips
          categories={categories}
          value={cat}
          onChange={setCat}
          maxVisible={8}
          sinCategoria={sinCategoria}
          className="mb-3"
        />
      )}

      {/* Vista "sin control de stock": el destino del aviso del dashboard. Dice
          en una línea qué está apagado y cómo se enciende — apagar alertas sin
          explicar dónde se arregla sería cambiar ruido por silencio. */}
      {soloSinControl && (
        <div className="mb-3 rounded-lg border border-warning/30 bg-warning/5 px-3.5 py-3">
          <div className="flex items-start gap-3">
            <PackageSearch className="mt-0.5 size-4 shrink-0 text-warning-ink" />
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-medium text-warning-ink">
                <span className="tabular">{sinControlStock}</span>{" "}
                {sinControlStock === 1 ? "producto sin contar" : "productos sin contar"}
              </p>
              <p className="mt-0.5 text-muted-foreground">
                Se venden normal. Poné cuántos tenés con el lápiz de cada fila y se
                encienden sus avisos de faltante.
              </p>
            </div>
            <Link
              href="/admin/productos"
              className="shrink-0 text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              Ver todos
            </Link>
          </div>
        </div>
      )}

      {drilldown && cat && (
        <div className="mb-3">
          <button
            type="button"
            onClick={() => setCat(null)}
            className="mb-2.5 flex cursor-pointer items-center gap-0.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="size-4" /> Categorías
          </button>
          <div className="flex items-center gap-2.5">
            {cat === SIN_CATEGORIA ? (
              <>
                <span
                  className="grid size-9 shrink-0 place-items-center rounded-lg bg-warning/15 text-warning-ink"
                  aria-hidden
                >
                  <FolderOpen className="size-4" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold">Sin categoría</h2>
                  {/* No hay herramienta de categorizar en masa (todavía): el camino
                      es el lápiz de cada fila, y lo decimos. */}
                  <p className="text-xs text-warning-ink">
                    Asignales categoría con el lápiz de cada fila.
                  </p>
                </div>
              </>
            ) : (
              <>
                <span
                  className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary text-lg"
                  aria-hidden
                >
                  {catActiva?.emoji ?? "📦"}
                </span>
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-semibold">{catActiva?.name ?? "Categoría"}</h2>
                  <p className="tabular text-xs text-muted-foreground">
                    {catActiva?.count ?? totalFiltrado} productos
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder={
            drilldown && cat
              ? `Buscar en ${cat === SIN_CATEGORIA ? "sin categoría" : (catActiva?.name ?? "la categoría")}`
              : "Buscar por nombre o código"
          }
          aria-label="Buscar producto"
          className="h-11 w-full rounded-lg border border-input bg-card pl-9 pr-9 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
        />
        {busqueda !== "" && (
          <button
            type="button"
            onClick={() => setBusqueda("")}
            aria-label="Limpiar búsqueda"
            className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* Entrada al modo selección: discreta en modo normal, contador + "Todos"
          + "Cancelar" cuando está activo. Solo sobre listas, nunca en el índice. */}
      {!enIndice && visibles.length > 0 && (
        <div className="mb-2 flex min-h-8 items-center justify-between gap-2">
          {seleccion === null ? (
            <>
              <span />
              <button
                type="button"
                onClick={() => setSeleccion(new Set())}
                className="flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
              >
                <ListChecks className="size-3.5" /> Seleccionar
              </button>
            </>
          ) : (
            <>
              <span className="tabular text-xs font-medium text-muted-foreground">
                {seleccion.size} seleccionado{seleccion.size === 1 ? "" : "s"}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setSeleccion((prev) => new Set([...(prev ?? []), ...visibles.map((p) => p.id)]))
                  }
                  className="h-8 cursor-pointer rounded-lg border border-border px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                >
                  Todos ({visibles.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSeleccion(null)}
                  className="h-8 cursor-pointer rounded-lg border border-border px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                >
                  Cancelar
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {enIndice ? (
        <IndiceCategorias
          categories={categories}
          sinCategoria={sinCategoria}
          sinControlStock={sinControlStock}
          onSelect={(id) => setCat(id, { push: true })}
        />
      ) : (
        <>
      <ul className="divide-y divide-border rounded-xl border border-border bg-card">
        {visibles.map((p) => {
          const m = margen(p.price, p.cost);
          const umbral = p.lowStockThreshold ?? defaultThreshold;
          /* Sin conteo, el número de stock no lo respalda nadie: pintarlo en
             ámbar diría "te estás quedando sin" sobre un dato inventado. */
          const sinControl = p.stockConfiable === false;
          const bajo = !sinControl && p.stock <= umbral;
          const marcado = seleccion?.has(p.id) ?? false;
          return (
            <li
              key={p.id}
              onClick={seleccion !== null ? () => toggleSeleccion(p.id) : undefined}
              onKeyDown={
                seleccion !== null
                  ? (e) => {
                      if (e.key === " " || e.key === "Enter") {
                        e.preventDefault();
                        toggleSeleccion(p.id);
                      }
                    }
                  : undefined
              }
              role={seleccion !== null ? "checkbox" : undefined}
              aria-checked={seleccion !== null ? marcado : undefined}
              aria-label={seleccion !== null ? `Seleccionar ${p.name}` : undefined}
              tabIndex={seleccion !== null ? 0 : undefined}
              className={cn(
                "flex items-center gap-3 px-4 py-3",
                seleccion !== null && "cursor-pointer transition-colors hover:bg-secondary/40",
                marcado && "bg-accent/40",
              )}
            >
              {seleccion !== null && (
                <span
                  className={cn(
                    "grid size-5 shrink-0 place-items-center rounded-md border transition-colors",
                    marcado
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-background",
                  )}
                  aria-hidden
                >
                  {marcado && <Check className="size-3.5" />}
                </span>
              )}
              {/* Chip y no emoji suelto: la fila pasa de "texto con dibujito" a
                  fila compuesta (V5). El emoji sigue siendo la identidad que
                  elige el kiosquero. */}
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary text-lg" aria-hidden>
                {p.emoji ?? "📦"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{p.name}</p>
                <p className="tabular truncate text-xs text-muted-foreground">
                  {money(p.price)}
                  {m !== null ? (
                    <span className="text-success-ink"> · {m.toFixed(0)}% margen</span>
                  ) : (
                    <span className="text-warning-ink"> · sin costo</span>
                  )}
                  {/* En resultados planos, saber DE DÓNDE es cada producto evita
                      abrir la ficha solo para ubicarlo. "Sin categoría" en tono de
                      aviso: la deuda se ve fila por fila, no solo en el índice. */}
                  {mostrarCatEnFila &&
                    (p.categoryId && catPorId.has(p.categoryId) ? (
                      <span> · {catPorId.get(p.categoryId)!.name}</span>
                    ) : (
                      <span className="text-warning-ink"> · sin categoría</span>
                    ))}
                </p>
              </div>
              {/* El stock en unidades no decide una compra; los días que dura,
                  sí. "29 u." es un dato; "te dura 6 días" es qué pedir esta
                  semana. */}
              <div className="shrink-0 text-right">
                {sinControl ? (
                  <span
                    className="inline-block rounded-full px-2 py-0.5 text-xs font-medium text-muted-foreground ring-1 ring-border"
                    title="Nadie contó este producto todavía: sus avisos de faltante están apagados."
                  >
                    sin contar
                  </span>
                ) : (
                  <span
                    className={cn(
                      "tabular inline-block rounded-full px-2 py-0.5 text-xs font-semibold",
                      bajo
                        ? "bg-warning/15 text-warning-ink ring-1 ring-warning/30"
                        : "text-muted-foreground",
                    )}
                  >
                    {p.stock} u.
                  </span>
                )}
                {!sinControl && p.diasCobertura !== null && p.stock > 0 && (
                  <p
                    className={cn(
                      "tabular mt-0.5 text-[11px]",
                      p.diasCobertura <= 2
                        ? "text-danger-ink"
                        : p.diasCobertura <= 7
                          ? "text-warning-ink"
                          : "text-muted-foreground",
                    )}
                  >
                    {p.diasCobertura < 1 ? "dura <1 día" : `dura ~${p.diasCobertura} días`}
                  </p>
                )}
              </div>
              {seleccion === null && (
                <button
                  type="button"
                  onClick={() => setEditando(p)}
                  aria-label={`Editar ${p.name}`}
                  className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-md border border-border text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                >
                  <Pencil className="size-3.5" />
                </button>
              )}
            </li>
          );
        })}
        {visibles.length === 0 && (
          <li className="px-4 py-10 text-center text-sm text-muted-foreground">
            {cargando ? "Buscando…" : "No hay productos que coincidan."}
          </li>
        )}
      </ul>

      {/* Paginación real (escala Fase 2): reemplaza el precargado de 500. Se pide de
          a 50; "mostrar más" en vez de páginas numeradas, que en mobile es veneno. */}
      {hayMas && (
        <button
          type="button"
          onClick={cargarMas}
          disabled={cargandoMas}
          className="mt-3 flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-border text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:opacity-50"
        >
          {cargandoMas && <LoaderCircle className="size-4 animate-spin" />}
          Mostrar más ({visibles.length} de {totalFiltrado})
        </button>
      )}

      {/* Barra de acción: sticky para que "Mover" esté a mano aunque la selección
          haya arrancado 30 filas más arriba. bottom-20 en mobile por la tab bar. */}
      {seleccion !== null && seleccion.size > 0 && (
        <div className="sticky bottom-20 z-30 mt-3 sm:bottom-4">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-popover p-3 shadow-lg">
            <span className="tabular text-sm font-medium">
              {seleccion.size} producto{seleccion.size === 1 ? "" : "s"}
            </span>
            <Button variant="primary" onClick={() => setMoviendo(true)}>
              <FolderOpen className="size-4" /> Mover a categoría
            </Button>
          </div>
        </div>
      )}
        </>
      )}

      {importando && (
        <ImportDialog
          margenDefault={margenDefault}
          redondeo={redondeo}
          onClose={() => setImportando(false)}
          onDone={(msg) => {
            setImportando(false);
            setAviso({ tone: "ok", text: msg });
            // El catálogo cambió entero: que la página lo vuelva a leer.
            router.refresh();
          }}
        />
      )}

      {remarcando && (
        <RepriceDialog
          categories={categories}
          products={products}
          totalProductos={totalProductos}
          onClose={() => setRemarcando(false)}
          onDone={(n) => {
            setRemarcando(false);
            setAviso({ tone: "ok", text: `Remarcaste ${n} producto${n === 1 ? "" : "s"}.` });
          }}
          onError={(e) => setAviso({ tone: "error", text: e })}
        />
      )}

      {moviendo && seleccion !== null && (
        <MoverDialog
          categories={categories}
          count={seleccion.size}
          pending={aplicandoMover}
          onApply={aplicarMover}
          onClose={() => setMoviendo(false)}
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

/**
 * Nivel 0 del drill-down: el catálogo contado por categoría, con las señales que
 * deciden una recorrida ("¿dónde tengo poco stock?", "¿qué me falta costear?").
 * "Sin categoría" cierra la lista en tono de aviso: es deuda visible, no un
 * cajón escondido.
 */
function IndiceCategorias({
  categories,
  sinCategoria,
  sinControlStock,
  onSelect,
}: {
  categories: CategoryRow[];
  sinCategoria: number;
  /** Puesta en marcha: la otra deuda visible del catálogo, al pie del índice. */
  sinControlStock: number;
  onSelect: (id: string) => void;
}) {
  const conProductos = categories.filter((c) => (c.count ?? 0) > 0);
  return (
    <ul className="divide-y divide-border rounded-xl border border-border bg-card">
      {conProductos.map((c) => {
        const stockBajo = c.stockBajo ?? 0;
        const sinCosto = c.sinCosto ?? 0;
        return (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onSelect(c.id)}
              className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/40"
            >
              <span
                className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary text-lg"
                aria-hidden
              >
                {c.emoji ?? "📦"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{c.name}</p>
                {(stockBajo > 0 || sinCosto > 0) && (
                  /* `flex-wrap` y NO `truncate`: a 360px las dos señales juntas
                     ("35 con poco stock · 247 sin costo") no entran en los 165px
                     de la fila, y `truncate` las cortaba a mitad de palabra —
                     quedaba "247 sin …", que no informa nada y se lee como un
                     bug. Es metadato secundario: que ocupe dos renglones cuesta
                     menos que dejar media frase colgada.
                     El separador se dibuja con `before:` sólo cuando hay dos
                     chips y quedan en la misma línea; al bajar de renglón no
                     aparece un "·" huérfano al principio. */
                  <p className="tabular flex flex-wrap items-center gap-x-1.5 text-xs">
                    {stockBajo > 0 && (
                      <span className="text-warning-ink">{stockBajo} con poco stock</span>
                    )}
                    {sinCosto > 0 && (
                      <span className="text-muted-foreground">{sinCosto} sin costo</span>
                    )}
                  </p>
                )}
              </div>
              <span className="tabular shrink-0 text-sm font-semibold text-muted-foreground">
                {c.count}
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground/70" />
            </button>
          </li>
        );
      })}
      {sinCategoria > 0 && (
        <li>
          <button
            type="button"
            onClick={() => onSelect(SIN_CATEGORIA)}
            className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-warning/5"
          >
            <span
              className="grid size-9 shrink-0 place-items-center rounded-lg bg-warning/15 text-warning-ink"
              aria-hidden
            >
              <FolderOpen className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Sin categoría</p>
              <p className="text-xs text-warning-ink">Ordenalos para encontrarlos más fácil</p>
            </div>
            <span className="tabular shrink-0 text-sm font-semibold text-warning-ink">
              {sinCategoria}
            </span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground/70" />
          </button>
        </li>
      )}
      {/* La segunda deuda visible, con el mismo trato que "Sin categoría": es un
          link y no un filtro de chip porque la vista trae su propia explicación. */}
      {sinControlStock > 0 && (
        <li>
          <Link
            href="/admin/productos?control=sin"
            className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-warning/5"
          >
            <span
              className="grid size-9 shrink-0 place-items-center rounded-lg bg-warning/15 text-warning-ink"
              aria-hidden
            >
              <PackageSearch className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Sin contar</p>
              <p className="text-xs text-warning-ink">
                Se venden, pero sin avisos de faltante
              </p>
            </div>
            <span className="tabular shrink-0 text-sm font-semibold text-warning-ink">
              {sinControlStock}
            </span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground/70" />
          </Link>
        </li>
      )}
      {conProductos.length === 0 && sinCategoria === 0 && (
        <li className="px-4 py-10 text-center text-sm text-muted-foreground">
          Todavía no hay productos activos.
        </li>
      )}
    </ul>
  );
}

/**
 * Destino del "mover en masa": una categoría por fila con su contador real, y
 * al pie la opción de quitar la categoría. Tocar una aplica directo — el paso
 * de confirmación es la propia barra ("N productos") que ya dice el alcance.
 */
function MoverDialog({
  categories,
  count,
  pending,
  onApply,
  onClose,
}: {
  categories: CategoryRow[];
  count: number;
  pending: boolean;
  onApply: (categoryId: string | null, nombre: string | null) => void;
  onClose: () => void;
}) {
  return (
    <Dialog title={`Mover ${count} producto${count === 1 ? "" : "s"} a…`} onClose={onClose}>
      <div className="space-y-3">
        <ul className="max-h-80 divide-y divide-border overflow-y-auto rounded-lg border border-border">
          {categories.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                disabled={pending}
                onClick={() => onApply(c.id, c.name)}
                className="flex w-full cursor-pointer items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-secondary/50 disabled:opacity-50"
              >
                <span aria-hidden className="text-base">
                  {c.emoji ?? "📦"}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.name}</span>
                <span className="tabular shrink-0 text-xs text-muted-foreground">
                  {c.count ?? 0}
                </span>
              </button>
            </li>
          ))}
          {categories.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">
              Todavía no tenés categorías. Crealas desde Ajustes.
            </li>
          )}
        </ul>
        <button
          type="button"
          disabled={pending}
          onClick={() => onApply(null, null)}
          className="flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-warning/40 text-sm font-medium text-warning-ink transition-colors hover:border-warning disabled:opacity-50"
        >
          Quitar categoría
        </button>
        {pending && (
          <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <LoaderCircle className="size-3.5 animate-spin" /> Moviendo…
          </p>
        )}
      </div>
    </Dialog>
  );
}

/** Remarcado masivo con PREVIEW: nadie toca los precios de todo su negocio a ciegas. */
function RepriceDialog({
  categories,
  products,
  totalProductos,
  onClose,
  onDone,
  onError,
}: {
  categories: CategoryRow[];
  products: ProductRow[];
  /** Total REAL de activos: `products` es apenas la página cargada. */
  totalProductos: number;
  onClose: () => void;
  onDone: (count: number) => void;
  onError: (msg: string) => void;
}) {
  const [pct, setPct] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const n = Number(pct);
  const valido = pct !== "" && !Number.isNaN(n) && n !== 0;

  /* Cuántos productos toca el remarcado: contadores REALES (categorias_resumen /
     count del server), no un .length sobre la página que casualmente está en
     memoria — la RPC remarca el catálogo entero. El preview sigue siendo
     best-effort sobre lo cargado: son ejemplos, no el alcance. */
  const alcanceN = categoryId
    ? (categories.find((c) => c.id === categoryId)?.count ?? 0)
    : totalProductos;
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
            <option value="">Todo el catálogo ({totalProductos})</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.emoji} {c.name} ({c.count ?? 0})
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
            {alcanceN > preview.length && (
              <p className="mt-2 text-xs text-muted-foreground">
                y {alcanceN - preview.length} más
              </p>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={aplicar}
          disabled={!valido || pending || alcanceN === 0}
          className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {pending && <LoaderCircle className="size-4 animate-spin" />}
          Remarcar {alcanceN} producto{alcanceN === 1 ? "" : "s"}
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

  /* Un producto SIN CONTAR no tiene contra qué sumar: pedirle "+10 o -3" sobre
     un número que nadie respalda no arregla nada. Se le pide el TOTAL en góndola
     y nosotros calculamos el delta — ese asiento es el baseline que enciende sus
     avisos (graduación, 037/038). Para el resto sigue siendo el ajuste de siempre. */
  const sinControl = product?.stockConfiable === false;

  function aplicarAjuste() {
    if (!product) return;
    const n = Number(ajuste);
    if (Number.isNaN(n) || ajuste.trim() === "") return;

    startTransition(async () => {
      // Contar (total) y ajustar (delta) son gestos distintos y van por caminos
      // distintos: contar puede dar el mismo número y aun así tiene que graduar.
      const res = sinControl
        ? await marcarStockContado(product.id, n)
        : n === 0
          ? { ok: true as const }
          : await adjustStock(product.id, n, n < 0 ? "waste" : "adjust", "ajuste manual");
      if (!res.ok) {
        onError(res.error);
        return;
      }
      onDone(sinControl ? "Contado. Ya te avisamos cuando quede poco." : "Stock ajustado.");
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
            {sinControl ? (
              <p className="text-xs font-medium text-warning-ink">
                Todavía nadie contó este producto: sus avisos de faltante están apagados.
              </p>
            ) : (
              <p className="text-xs font-medium text-muted-foreground">
                Stock actual:{" "}
                <span className="tabular font-semibold text-foreground">{product.stock} u.</span>
              </p>
            )}
            <div className="flex gap-2">
              <input
                value={ajuste}
                onChange={(e) =>
                  setAjuste(e.target.value.replace(sinControl ? /[^\d]/g : /[^\d-]/g, ""))
                }
                inputMode="numeric"
                placeholder={sinControl ? "¿Cuántos tenés?" : "+10 o -3"}
                aria-label={sinControl ? "Cantidad contada en la góndola" : "Ajuste de stock"}
                className="tabular h-10 flex-1 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary"
              />
              <button
                type="button"
                onClick={aplicarAjuste}
                disabled={pending || ajuste.trim() === ""}
                className={cn(
                  "h-10 shrink-0 cursor-pointer whitespace-nowrap rounded-lg px-3 text-sm font-medium transition-colors disabled:opacity-40",
                  sinControl
                    ? "bg-primary text-primary-foreground hover:opacity-90"
                    : "border border-border hover:border-primary",
                )}
              >
                {sinControl ? "Guardar" : "Ajustar"}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              {sinControl
                ? "Contá lo que hay en la góndola. Desde ahí te avisamos cuando quede poco."
                : "El ajuste queda asentado. Un número negativo se registra como merma."}
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
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/60 p-0 sm:place-items-center sm:p-4">
      <div className="max-h-[85dvh] w-full overflow-y-auto rounded-t-2xl border border-border bg-popover p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:max-w-md sm:rounded-2xl">
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
