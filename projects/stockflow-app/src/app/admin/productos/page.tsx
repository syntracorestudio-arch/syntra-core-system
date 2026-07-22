import { AppShell } from "@/components/shell/app-shell";
import { requireOwner } from "@/lib/session";
import { createSupabaseServer } from "@/lib/supabase/server";
import { ProductsClient, type ProductRow, type CategoryRow } from "./products-client";

export const dynamic = "force-dynamic";

export default async function ProductosPage() {
  const session = await requireOwner();
  const supabase = await createSupabaseServer();

  const [{ data: products }, { data: categories }] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, emoji, price, cost, stock, low_stock_threshold, category_id, status")
      .eq("status", "active")
      .order("name")
      .limit(500),
    supabase.from("categories").select("id, name, emoji, color").eq("status", "active").order("sort"),
  ]);

  const rows: ProductRow[] = (products ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    emoji: p.emoji,
    price: Number(p.price),
    cost: p.cost === null ? null : Number(p.cost),
    stock: Number(p.stock),
    lowStockThreshold: p.low_stock_threshold,
    categoryId: p.category_id,
  }));

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
