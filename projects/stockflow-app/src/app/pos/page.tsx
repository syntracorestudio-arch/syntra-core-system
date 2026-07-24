import { requireSession } from "@/lib/session";
import { createSupabaseServer } from "@/lib/supabase/server";
import { PosScreen, type PosProduct } from "@/components/pos/pos-screen";
import { getStoreMpAuth } from "@/lib/mercadopago";

export const dynamic = "force-dynamic";

/**
 * Ventana de ritmo de venta. 14 días es lo que hace falta para que la grilla
 * se ordene por lo que REALMENTE se vende (la Coca y el Marlboro en la primera
 * fila, sin buscar). Va en una función y no en el cuerpo del componente porque
 * el reloj es impuro — mismo patrón que `rango()` en Reportes.
 */
function desdeHace(dias: number): string {
  return new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * Caja. Trae el catálogo del negocio (la RLS ya filtra por tenant, pero igual
 * acotamos a activos) y los códigos de barras para resolver el escaneo sin ir a
 * la base en cada beep.
 *
 * `limit` explícito: un catálogo de kiosco ronda los cientos, pero una lista sin
 * techo es deuda con interés (baseline). Si un negocio lo supera, el POS pasa a
 * búsqueda server-side en vez de precargar.
 */
export default async function PosPage() {
  const session = await requireSession();
  const supabase = await createSupabaseServer();

  // Solo el hecho de estar conectado; el token nunca sale del servidor.
  const mpConectado = (await getStoreMpAuth(session.store.id)) !== null;

  const desde = desdeHace(14);

  const [{ data: products }, { data: barcodes }, { data: clients }, { data: vendidos }] =
    await Promise.all([
      supabase
        .from("products")
        .select("id, name, emoji, color, price, stock, category_id, categories(name, color)")
        .eq("status", "active")
        .order("name")
        .limit(500),
      supabase.from("product_barcodes").select("product_id, barcode").limit(2000),
      /* Los saldos vienen de la vista, no de `clients`: el cajero tiene que ver
         cuánto debe cada uno ANTES de fiarle, que es cuando se decide. */
      supabase
        .from("client_balances")
        .select("client_id, name, credit_limit, balance")
        .order("name")
        .limit(300),
      supabase
        .from("sale_items")
        .select("product_id, qty, sales!inner(sold_at, status)")
        .eq("sales.status", "completed")
        .gte("sales.sold_at", desde)
        .limit(5000),
    ]);

  const byProduct = new Map<string, string[]>();
  for (const b of barcodes ?? []) {
    const list = byProduct.get(b.product_id) ?? [];
    list.push(b.barcode);
    byProduct.set(b.product_id, list);
  }

  const ritmo = new Map<string, number>();
  for (const v of vendidos ?? []) {
    ritmo.set(v.product_id, (ritmo.get(v.product_id) ?? 0) + Number(v.qty));
  }

  const catalog: PosProduct[] = (products ?? []).map((p) => {
    const category = p.categories as unknown as { name: string; color: string } | null;
    return {
      id: p.id,
      name: p.name,
      emoji: p.emoji,
      color: p.color ?? category?.color ?? null,
      price: Number(p.price),
      stock: Number(p.stock),
      categoryId: p.category_id,
      categoryName: category?.name ?? null,
      barcodes: byProduct.get(p.id) ?? [],
      sold14d: ritmo.get(p.id) ?? 0,
    };
  });

  return (
    <PosScreen
      storeName={session.store.name}
      products={catalog}
      clients={(clients ?? []).map((c) => ({
        id: c.client_id as string,
        name: c.name as string,
        // El ledger guarda la deuda en negativo; acá la exponemos en positivo.
        owed: Math.max(0, -Number(c.balance ?? 0)),
        creditLimit: c.credit_limit === null ? null : Number(c.credit_limit),
      }))}
      canSellOnCredit={session.member.role === "owner" || session.member.can_sell_on_credit}
      isOwner={session.member.role === "owner"}
      mpConectado={mpConectado}
    />
  );
}
