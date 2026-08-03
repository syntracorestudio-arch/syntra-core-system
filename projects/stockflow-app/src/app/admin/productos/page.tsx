import { AppShell } from "@/components/shell/app-shell";
import { requireOwner } from "@/lib/session";
import { createSupabaseServer } from "@/lib/supabase/server";
import { ProductsClient, type ProductRow, type CategoryRow } from "./products-client";

export const dynamic = "force-dynamic";

export default async function ProductosPage({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string; q?: string; control?: string }>;
}) {
  const session = await requireOwner();
  const supabase = await createSupabaseServer();

  /* DRILL-DOWN — el filtro vive en la URL (?cat=, ?q=): refrescar o compartir un
     link a "Productos > Bebidas" tiene que traer ESA vista desde el server, no la
     portada y un parpadeo. `cat=none` es el filtro "sin categoría". */
  const sp = await searchParams;
  const cat = sp.cat?.trim() || null;
  const q = sp.q?.trim() || null;
  /* `?control=sin` = los productos que se venden pero nadie contó todavía
     (puesta en marcha, 038). Es el destino del aviso del dashboard: apagar sus
     alertas obliga a que exista este lugar donde verlos. */
  const soloSinControl = sp.control === "sin";

  /* ESCALA FASE 2 — search-first. Antes viajaban 500 productos + ~8000 sale_items
     (772 KB de documento con 2005 SKUs) y el filtrado era en memoria. Ahora la
     primera página la trae `productos_buscar` y el resto lo pide el cliente. */
  const [{ data: pagina }, { data: categories }, { count: totalProductos }, { data: settings }] =
    await Promise.all([
    supabase.rpc("productos_buscar", {
      p_store_id: session.store.id,
      p_q: q,
      p_categoria: cat && cat !== "none" ? cat : null,
      p_solo_sin_categoria: cat === "none",
      p_solo_sin_control: soloSinControl,
      p_limit: 50,
      p_offset: 0,
    }),
    // Categorías con CONTADORES REALES (036): chips, índice del drill-down y los
    // selects de los diálogos salen todos de la misma fuente de verdad, acotada a 100.
    supabase.rpc("categorias_resumen", { p_store_id: session.store.id }),
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
    // Margen y redondeo: con eso el import propone precio cuando la planilla
    // solo trae el costo (una lista de proveedor se vuelve catálogo vendible).
    supabase
      .from("store_settings")
      .select("margen_default_pct, reprice_rounding")
      .eq("store_id", session.store.id)
      .maybeSingle(),
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
      stock_confiable?: boolean;
      vendidas_30d: string | number;
    }[];
    total: number;
  };

  /* Índice y chips del panel: ordenados por CANTIDAD de productos (el criterio del
     dueño administrando, no el del mostrador vendiendo). Contadores reales del
     agregado, incluidas las señales de salud (stock bajo / sin costo) que muestra
     el índice del drill-down. */
  const resumen = (categories ?? { categorias: [], sin_categoria: { productos: 0 } }) as {
    categorias: {
      id: string;
      name: string;
      emoji: string | null;
      color: string | null;
      productos: number;
      stock_bajo: number;
      sin_costo: number;
    }[];
    sin_categoria: { productos: number; stock_bajo: number; sin_costo: number };
    sin_control_stock?: { productos: number };
  };
  const categoriasOrdenadas: CategoryRow[] = [...(resumen.categorias ?? [])]
    .sort((a, b) => Number(b.productos) - Number(a.productos) || a.name.localeCompare(b.name, "es"))
    .map((c) => ({
      id: c.id,
      name: c.name,
      emoji: c.emoji,
      color: c.color,
      count: Number(c.productos),
      stockBajo: Number(c.stock_bajo ?? 0),
      sinCosto: Number(c.sin_costo ?? 0),
    }));
  const sinCategoria = Number(resumen.sin_categoria?.productos ?? 0);
  const sinControlStock = Number(resumen.sin_control_stock?.productos ?? 0);

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
      stockConfiable: p.stock_confiable ?? true,
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
        totalFiltradoInicial={Number(p0.total ?? rows.length)}
        initialQ={q ?? ""}
        categories={categoriasOrdenadas}
        sinCategoria={sinCategoria}
        sinControlStock={sinControlStock}
        soloSinControl={soloSinControl}
        defaultThreshold={3}
        totalProductos={totalProductos ?? rows.length}
        margenDefault={Number(settings?.margen_default_pct ?? 35)}
        redondeo={Number(settings?.reprice_rounding ?? 50)}
      />
    </AppShell>
  );
}
