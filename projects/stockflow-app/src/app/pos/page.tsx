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
  const mpAuth = await getStoreMpAuth(session.store.id);
  const mpConectado = mpAuth !== null;


  /* ESCALA FASE 2 — search-first. La caja YA NO precarga el catálogo.
     Antes viajaban 500 productos + ~5000 sale_items (solo para rankear en el
     cliente) + ~1750 códigos + ~300 clientes = 477 KB de documento con 2005 SKUs.
     Ahora:
       · los tiles vienen ya rankeados de `pos_destacados` (set chico, con SUS
         códigos para que escanear un top-seller siga sin round-trip),
       · buscar va a `productos_buscar` (server-side),
       · escanear lo que no está en los tiles lo resuelve `producto_por_codigo`
         (Fase 1, intacto),
       · los clientes de fiado se piden recién al abrir ese medio de pago. */
  const [
    { data: destacados },
    { data: settings },
    { data: categories },
    { count: totalProductos },
  ] = await Promise.all([
      supabase.rpc("pos_destacados", { p_store_id: session.store.id, p_limit: 24 }),
      supabase
        .from("store_settings")
        .select("transfer_alias, confirm_methods, has_posnet")
        .eq("store_id", session.store.id)
        .maybeSingle(),
      // Categorías EXISTENTES para el alta rápida (escala Fase 1): sin esto, todo lo
      // que se da de alta en la caja caía en "Sin categoría". Acotada — un negocio con
      // más de 100 categorías tiene otro problema.
      supabase
        .from("categories")
        .select("id, name, emoji")
        .eq("status", "active")
        .order("sort")
        .limit(100),
      // Conteo REAL del catálogo (head: no trae filas), para decir cuántos productos
      // hay de verdad sin traer ninguno.
      supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("status", "active"),
    ]);

  // La terminal Point se ofrece solo si el negocio la prendió Y quedó una terminal
  // configurada: sin las dos cosas, la caja cobra con QR como siempre (cero fricción
  // para el que no tiene posnet).
  const posnetActivo = mpConectado && !!mpAuth?.mpTerminalId && Boolean(settings?.has_posnet);

  // Perilla de confirmación por método (default todos ON si falta el dato).
  const cm = (settings?.confirm_methods ?? {}) as Record<string, boolean>;
  const confirmMethods = {
    cash: cm.cash ?? true,
    card: cm.card ?? true,
    transfer: cm.transfer ?? true,
    account: cm.account ?? true,
  };

  /* Los destacados llegan YA rankeados y con sus códigos: el cliente no calcula
     nada, solo mapea. Es todo el catálogo que viaja en el primer render. */
  const catalog: PosProduct[] = (
    (destacados ?? []) as {
      id: string;
      name: string;
      emoji: string | null;
      color: string | null;
      price: string | number;
      stock: string | number;
      category_id: string | null;
      category_name: string | null;
      vendidas_14d: string | number;
      barcodes: string[] | null;
    }[]
  ).map((p) => ({
    id: p.id,
    name: p.name,
    emoji: p.emoji,
    color: p.color,
    price: Number(p.price),
    stock: Number(p.stock),
    categoryId: p.category_id,
    categoryName: p.category_name,
    barcodes: p.barcodes ?? [],
    sold14d: Number(p.vendidas_14d ?? 0),
  }));

  return (
    <PosScreen
      storeName={session.store.name}
      products={catalog}
      canSellOnCredit={session.member.role === "owner" || session.member.can_sell_on_credit}
      isOwner={session.member.role === "owner"}
      mpConectado={mpConectado}
      posnetActivo={posnetActivo}
      transferAlias={settings?.transfer_alias ?? null}
      confirmMethods={confirmMethods}
      categories={(categories ?? []).map((c) => ({
        id: c.id as string,
        name: c.name as string,
        emoji: (c.emoji as string | null) ?? null,
      }))}
      totalProductos={totalProductos ?? catalog.length}
    />
  );
}
