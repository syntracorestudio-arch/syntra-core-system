import { AppShell } from "@/components/shell/app-shell";
import { requireOwner } from "@/lib/session";
import { createSupabaseServer } from "@/lib/supabase/server";
import { ProductsClient, type ProductRow, type CategoryRow } from "./products-client";

export const dynamic = "force-dynamic";

/** El reloj es impuro: fuera del cuerpo del componente (patrón de Reportes). */
function desdeHace(dias: number): string {
  return new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString();
}

export default async function ProductosPage() {
  const session = await requireOwner();
  const supabase = await createSupabaseServer();

  const [{ data: products }, { data: categories }, { data: vendidos }] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, emoji, price, cost, stock, low_stock_threshold, category_id, status")
      .eq("status", "active")
      .order("name")
      .limit(500),
    supabase.from("categories").select("id, name, emoji, color").eq("status", "active").order("sort"),
    /* Ritmo de venta de 30 días: convierte "29 u." en una decisión de compra
       ("te dura 6 días"). Acotado por fecha + limit, como manda el baseline. */
    supabase
      .from("sale_items")
      .select("product_id, qty, sales!inner(sold_at, status)")
      .eq("sales.status", "completed")
      .gte("sales.sold_at", desdeHace(30))
      .limit(8000),
  ]);

  const vendidas30 = new Map<string, number>();
  for (const v of vendidos ?? []) {
    vendidas30.set(v.product_id, (vendidas30.get(v.product_id) ?? 0) + Number(v.qty));
  }

  const rows: ProductRow[] = (products ?? []).map((p) => {
    const porDia = (vendidas30.get(p.id) ?? 0) / 30;
    const stock = Number(p.stock);
    return {
      id: p.id,
      name: p.name,
      emoji: p.emoji,
      price: Number(p.price),
      cost: p.cost === null ? null : Number(p.cost),
      stock,
      lowStockThreshold: p.low_stock_threshold,
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
        categories={(categories ?? []) as CategoryRow[]}
        defaultThreshold={3}
      />
    </AppShell>
  );
}
