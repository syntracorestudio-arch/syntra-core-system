import { AppShell } from "@/components/shell/app-shell";
import { requireSession } from "@/lib/session";
import { createSupabaseServer } from "@/lib/supabase/server";
import { IngresoClient, type IngresoProduct } from "./ingreso-client";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** El reloj es impuro: fuera del cuerpo del componente (patrón de Reportes). */
function desdeHace(dias: number): string {
  return new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString();
}

export default async function IngresoPage() {
  const session = await requireSession();
  if (!(session.member.role === "owner" || session.member.can_receive_stock)) {
    redirect("/pos");
  }

  const supabase = await createSupabaseServer();
  const [{ data: products }, { data: barcodes }, { data: compras }] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, emoji, price, cost, stock")
      .eq("status", "active")
      .order("name")
      .limit(500),
    supabase.from("product_barcodes").select("product_id, barcode").limit(2000),
    /* Compras del último año: de acá sale "la última vez pagaste $800, hace 20
       días". Es el radar de inflación en el punto donde entra el dato. */
    supabase
      .from("stock_ledger")
      .select("product_id, unit_cost, created_at")
      .eq("reason", "purchase")
      .not("unit_cost", "is", null)
      .gte("created_at", desdeHace(365))
      .order("created_at", { ascending: false })
      .limit(3000),
  ]);

  const byProduct = new Map<string, string[]>();
  for (const b of barcodes ?? []) {
    const list = byProduct.get(b.product_id) ?? [];
    list.push(b.barcode);
    byProduct.set(b.product_id, list);
  }

  // La primera aparición es la más reciente: la consulta ya viene ordenada.
  const ultimaCompra = new Map<string, { costo: number; fecha: string }>();
  for (const c of compras ?? []) {
    if (!ultimaCompra.has(c.product_id)) {
      ultimaCompra.set(c.product_id, { costo: Number(c.unit_cost), fecha: c.created_at });
    }
  }

  const rows: IngresoProduct[] = (products ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    emoji: p.emoji,
    price: Number(p.price),
    cost: p.cost === null ? null : Number(p.cost),
    stock: Number(p.stock),
    barcodes: byProduct.get(p.id) ?? [],
    ultimaCompra: ultimaCompra.get(p.id) ?? null,
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
