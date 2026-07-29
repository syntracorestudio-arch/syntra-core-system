import { AppShell } from "@/components/shell/app-shell";
import { requireOwner } from "@/lib/session";
import { createSupabaseServer } from "@/lib/supabase/server";
import { ProductsClient, type ProductRow, type CategoryRow } from "./products-client";

export const dynamic = "force-dynamic";

export default async function ProductosPage() {
  const session = await requireOwner();
  const supabase = await createSupabaseServer();

  /* ESCALA FASE 2 — search-first. Antes viajaban 500 productos + ~8000 sale_items
     (772 KB de documento con 2005 SKUs) y el filtrado era en memoria. Ahora la
     primera página la trae `productos_buscar` y el resto lo pide el cliente. */
  const [{ data: pagina }, { data: categories }, { count: totalProductos }] = await Promise.all([
    supabase.rpc("productos_buscar", {
      p_store_id: session.store.id,
      p_q: null,
      p_categoria: null,
      p_limit: 50,
      p_offset: 0,
    }),
    // Categorías con CONTADORES REALES (036): chips, sheet de "Más" y los selects
    // de los diálogos salen todos de la misma fuente de verdad, acotada a 100.
    supabase.rpc("categorias_resumen", { p_store_id: session.store.id }),
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
  ]);

  const p0 = (pagina ?? { items: [], total: 0 }) as {
    items: {
      id: string;
      name: string;
      emoji: string | null;
      price: string | number;
      cost: string | number | null;
      stock: string | number;
      low_stock_threshold: string | number | null;
      category_id: string | null;
      vendidas_30d: string | number;
    }[];
    total: number;
  };

  /* Chips del panel: ordenados por CANTIDAD de productos (el criterio del dueño
     administrando, no el del mostrador vendiendo). Contadores reales del agregado. */
  const resumen = (categories ?? { categorias: [], sin_categoria: { productos: 0 } }) as {
    categorias: {
      id: string;
      name: string;
      emoji: string | null;
      color: string | null;
      productos: number;
    }[];
    sin_categoria: { productos: number };
  };
  const categoriasOrdenadas: CategoryRow[] = [...(resumen.categorias ?? [])]
    .sort((a, b) => Number(b.productos) - Number(a.productos) || a.name.localeCompare(b.name, "es"))
    .map((c) => ({
      id: c.id,
      name: c.name,
      emoji: c.emoji,
      color: c.color,
      count: Number(c.productos),
    }));
  const sinCategoria = Number(resumen.sin_categoria?.productos ?? 0);

  const rows: ProductRow[] = (p0.items ?? []).map((p) => {
    const porDia = Number(p.vendidas_30d ?? 0) / 30;
    const stock = Number(p.stock);
    return {
      id: p.id,
      name: p.name,
      emoji: p.emoji,
      price: Number(p.price),
      cost: p.cost === null ? null : Number(p.cost),
      stock,
      lowStockThreshold: p.low_stock_threshold === null ? null : Number(p.low_stock_threshold),
      categoryId: p.category_id,
      // Sin ventas en 30 días no hay ritmo que proyectar: preferimos no decir
      // nada antes que inventar una cobertura infinita.
      diasCobertura: porDia > 0 ? Math.floor(stock / porDia) : null,
    };
  });

  return (
    <AppShell
      current="/admin/productos"
      storeName={session.store.name}
      userLabel={`${session.member.display_name ?? "Vos"} · Dueño`}
    >
      <ProductsClient
        products={rows}
        categories={categoriasOrdenadas}
        sinCategoria={sinCategoria}
        defaultThreshold={3}
        totalProductos={totalProductos ?? rows.length}
      />
    </AppShell>
  );
}
