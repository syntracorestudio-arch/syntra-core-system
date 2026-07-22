import { requireSession } from "@/lib/session";
import { createSupabaseServer } from "@/lib/supabase/server";
import { PosScreen, type PosProduct } from "@/components/pos/pos-screen";
import { getStoreMpAuth } from "@/lib/mercadopago";

export const dynamic = "force-dynamic";

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

  const [{ data: products }, { data: barcodes }, { data: clients }] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, emoji, color, price, stock, category_id, categories(name, color)")
      .eq("status", "active")
      .order("name")
      .limit(500),
    supabase.from("product_barcodes").select("product_id, barcode").limit(2000),
    supabase
      .from("clients")
      .select("id, name, phone")
      .eq("status", "active")
      .order("name")
      .limit(300),
  ]);

  const byProduct = new Map<string, string[]>();
  for (const b of barcodes ?? []) {
    const list = byProduct.get(b.product_id) ?? [];
    list.push(b.barcode);
    byProduct.set(b.product_id, list);
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
      categoryName: category?.name ?? null,
      barcodes: byProduct.get(p.id) ?? [],
    };
  });

  return (
    <PosScreen
      storeName={session.store.name}
      products={catalog}
      clients={clients ?? []}
      canSellOnCredit={session.member.role === "owner" || session.member.can_sell_on_credit}
      isOwner={session.member.role === "owner"}
      mpConectado={mpConectado}
    />
  );
}
