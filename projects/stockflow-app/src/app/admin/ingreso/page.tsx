import { AppShell } from "@/components/shell/app-shell";
import { requireSession } from "@/lib/session";
import { createSupabaseServer } from "@/lib/supabase/server";
import { IngresoClient, type IngresoProduct } from "./ingreso-client";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function IngresoPage() {
  const session = await requireSession();
  if (!(session.member.role === "owner" || session.member.can_receive_stock)) {
    redirect("/pos");
  }

  const supabase = await createSupabaseServer();
  const [{ data: products }, { data: barcodes }] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, emoji, price, cost, stock")
      .eq("status", "active")
      .order("name")
      .limit(500),
    supabase.from("product_barcodes").select("product_id, barcode").limit(2000),
  ]);

  const byProduct = new Map<string, string[]>();
  for (const b of barcodes ?? []) {
    const list = byProduct.get(b.product_id) ?? [];
    list.push(b.barcode);
    byProduct.set(b.product_id, list);
  }

  const rows: IngresoProduct[] = (products ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    emoji: p.emoji,
    price: Number(p.price),
    cost: p.cost === null ? null : Number(p.cost),
    stock: Number(p.stock),
    barcodes: byProduct.get(p.id) ?? [],
  }));

  return (
    <AppShell
      current="/admin/ingreso"
      storeName={session.store.name}
      userLabel={`${session.member.display_name ?? "Vos"} · ${
        session.member.role === "owner" ? "Dueño" : "Empleado"
      }`}
    >
      <IngresoClient products={rows} />
    </AppShell>
  );
}
