"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase/server";
import { requireSession } from "@/lib/session";

/**
 * Cobro. Toda la lógica pesada (atomicidad, stock, fiado, idempotencia) vive en
 * la RPC `register_sale`: acá solo validamos la forma y traducimos el error a
 * castellano. Nunca escribimos ventas ni ledgers desde la app.
 */

/**
 * `z.guid()` y no `z.uuid()`: Zod 4 valida RFC-4122 estricto (bits de versión y
 * variante), y eso rechaza identificadores que Postgres acepta sin problema —
 * entre ellos los UUID legibles del seed (`d1000000-0000-…`). Acá queremos
 * validar la FORMA, no el linaje del UUID; la base es la autoridad del tipo.
 */
const itemSchema = z.object({
  product_id: z.guid().nullable(),
  qty: z.number().positive(),
  unit_price: z.number().nonnegative().nullable().optional(),
  free_amount: z.number().positive().nullable().optional(),
  name: z.string().max(80).nullable().optional(),
});

const saleSchema = z.object({
  items: z.array(itemSchema).min(1),
  payment_method: z.enum(["cash", "qr", "card", "transfer", "account"]),
  idempotency_key: z.string().min(8).max(64),
  client_id: z.guid().nullable().optional(),
  // El cobro ya se acreditó (QR pagado): registrar es un hecho, no una intención
  // → no lo frena un producto archivado ni el stock estricto (M4). Solo lo manda
  // el camino post-cobro-QR; una venta normal en efectivo va sin esto.
  paid: z.boolean().optional(),
  // Con cuánto pagó el cliente en efectivo (para reconciliar caja). Solo efectivo.
  cash_tendered: z.number().nonnegative().optional(),
});

export type SaleResult =
  | {
      ok: true;
      saleId: string;
      total: number;
      replayed: boolean;
      overLimit: boolean;
      negativeStock: { product_id: string; name: string; stock: number }[];
    }
  | { ok: false; error: string };

/** Errores de la RPC → castellano del mostrador. */
const ERRORS: Record<string, string> = {
  not_a_member: "Tu sesión no es válida. Volvé a entrar.",
  not_allowed: "No tenés permiso para esta acción.",
  empty_items: "La venta está vacía.",
  invalid_qty: "Revisá las cantidades.",
  invalid_amount: "Revisá el monto.",
  invalid_payment_method: "Elegí un medio de pago válido.",
  product_not_found: "Un producto ya no está disponible. Actualizá la caja.",
  product_archived: "Un producto fue dado de baja. Sacalo de la venta.",
  insufficient_stock: "No hay stock suficiente y tu negocio no permite vender en negativo.",
  client_required: "Elegí a quién le fiás.",
  client_not_found: "Ese cliente no existe.",
  idempotency_key_reused: "Este cobro se mezcló con otra venta. Vaciá y armá la venta de nuevo.",
  // Pago dividido (Paso 1)
  split_needs_two: "Un pago dividido necesita al menos dos partes.",
  invalid_split_payment: "Revisá los montos del pago dividido.",
  split_sum_mismatch: "Las partes no suman el total de la venta.",
};

function translate(message: string): string {
  for (const [code, text] of Object.entries(ERRORS)) {
    if (message.includes(code)) return text;
  }
  return "No pudimos cobrar. Probá de nuevo.";
}

export async function registerSale(input: unknown): Promise<SaleResult> {
  const session = await requireSession();

  const parsed = saleSchema.safeParse(input);
  if (!parsed.success) {
    console.error("[registerSale] payload inválido:", JSON.stringify(parsed.error.issues));
    return { ok: false, error: "Datos de la venta inválidos." };
  }

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.rpc("register_sale", {
    p_store_id: session.store.id,
    p_items: parsed.data.items,
    p_payment_method: parsed.data.payment_method,
    p_idempotency_key: parsed.data.idempotency_key,
    p_client_id: parsed.data.client_id ?? null,
    p_paid: parsed.data.paid ?? false,
  });

  if (error) {
    return { ok: false, error: translate(error.message) };
  }

  const result = data as {
    sale_id: string;
    total: number;
    replayed: boolean;
    over_limit: boolean;
    negative_stock: { product_id: string; name: string; stock: number }[];
  };

  // Con cuánto pagó (efectivo): se persiste aparte, sin tocar register_sale (la RPC
  // reina queda intacta). Solo en una venta NUEVA de efectivo; el vuelto se deriva.
  if (
    parsed.data.payment_method === "cash" &&
    parsed.data.cash_tendered != null &&
    !result.replayed
  ) {
    await supabase.rpc("guardar_efectivo_entregado", {
      p_store_id: session.store.id,
      p_sale_id: result.sale_id,
      p_tendered: parsed.data.cash_tendered,
    });
  }

  // El catálogo del POS y el panel del dueño muestran stock: quedaron viejos.
  revalidatePath("/pos");
  revalidatePath("/admin");

  return {
    ok: true,
    saleId: result.sale_id,
    total: Number(result.total),
    replayed: result.replayed,
    overLimit: result.over_limit,
    negativeStock: result.negative_stock ?? [],
  };
}

/**
 * Pago dividido (Paso 1): una venta cobrada en varias partes (efectivo/tarjeta/
 * transferencia; QR y fiado quedan afuera en v1). Toda la seguridad vive en
 * `register_split_sale`: es ATÓMICA (reusa register_sale + inserta el reparto en la
 * misma transacción y valida que sume el total server-side). Acá solo validamos forma.
 */
const splitPaymentSchema = z.object({
  // 'qr' se admite desde el Paso 2 (una parte del split cobrada por QR).
  method: z.enum(["cash", "card", "transfer", "qr"]),
  amount: z.number().positive(),
});

const splitSaleSchema = z.object({
  items: z.array(itemSchema).min(1),
  pagos: z.array(splitPaymentSchema).min(2),
  idempotency_key: z.string().min(8).max(64),
  // true cuando la parte QR ya se acreditó (Paso 2): la venta es un hecho, no la frena
  // el stock estricto ni un producto archivado (M4). El split offline va sin esto.
  paid: z.boolean().optional(),
});

export async function registerSplitSale(input: unknown): Promise<SaleResult> {
  const session = await requireSession();

  const parsed = splitSaleSchema.safeParse(input);
  if (!parsed.success) {
    console.error("[registerSplitSale] payload inválido:", JSON.stringify(parsed.error.issues));
    return { ok: false, error: "Datos del pago dividido inválidos." };
  }

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.rpc("register_split_sale", {
    p_store_id: session.store.id,
    p_items: parsed.data.items,
    p_pagos: parsed.data.pagos,
    p_idempotency_key: parsed.data.idempotency_key,
    p_paid: parsed.data.paid ?? false,
  });

  if (error) {
    return { ok: false, error: translate(error.message) };
  }

  const result = data as {
    sale_id: string;
    total: number;
    replayed: boolean;
    over_limit: boolean;
    negative_stock: { product_id: string; name: string; stock: number }[];
  };

  revalidatePath("/pos");
  revalidatePath("/admin");

  return {
    ok: true,
    saleId: result.sale_id,
    total: Number(result.total),
    replayed: result.replayed,
    overLimit: result.over_limit,
    negativeStock: result.negative_stock ?? [],
  };
}

/**
 * Consulta el catálogo compartido por código de barras.
 *
 * Es lo que convierte el alta de "escribí el nombre completo" a "confirmá y poné
 * el precio". Un kiosco tiene 300-800 productos: sin esto, cargarlos son horas
 * de trabajo ANTES de que el sistema le sirva para algo, y ahí es donde se
 * abandona el producto.
 */
export async function buscarEnCatalogo(
  barcode: string,
): Promise<{ nombre: string; marca: string | null } | null> {
  await requireSession();
  if (!/^\d{8,14}$/.test(barcode)) return null;

  const supabase = await createSupabaseServer();
  const { data } = await supabase.rpc("catalogo_buscar", { p_ean: barcode });
  if (!data) return null;

  const r = data as { nombre: string; marca: string | null };
  return { nombre: r.nombre, marca: r.marca };
}

/**
 * Busca en el catálogo por NOMBRE, para cuando el código no está.
 *
 * Es el camino de los cigarrillos —que SEPA no publica— y de cualquier producto
 * que el dataset no cubra: el kiosquero escribe "marl", elige de la lista, y su
 * escaneo aporta el código real que nadie tenía.
 */
export async function buscarPorNombre(
  texto: string,
): Promise<{ ean: string; nombre: string; marca: string | null }[]> {
  await requireSession();
  if (texto.trim().length < 2) return [];

  const supabase = await createSupabaseServer();
  const { data } = await supabase.rpc("catalogo_buscar_nombre", { p_texto: texto.trim() });
  return (data ?? []) as { ean: string; nombre: string; marca: string | null }[];
}

/**
 * Resuelve un código de barras contra la BASE del negocio (escala Fase 1).
 *
 * Cierra el RIESGO 0 (`docs/inventario-escala-audit.md`): la caja precarga el catálogo
 * acotado (`limit(500)` por nombre), así que un producto que EXISTE puede no estar en
 * memoria. Sin esto, escanearlo abría "alta rápida" y el cajero creaba un DUPLICADO con
 * stock 0. La RPC devuelve una fila o null, con gate de miembro.
 */
export type ProductoPorCodigo = {
  id: string;
  name: string;
  emoji: string | null;
  color: string | null;
  price: number;
  stock: number;
  categoryId: string | null;
  categoryName: string | null;
  archivado: boolean;
  barcodes: string[];
};

export async function buscarProductoPorCodigo(
  codigo: string,
): Promise<ProductoPorCodigo | null> {
  const session = await requireSession();
  const limpio = codigo.trim();
  if (!limpio || limpio.length > 64) return null;

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.rpc("producto_por_codigo", {
    p_store_id: session.store.id,
    p_codigo: limpio,
  });

  if (error || !data) return null;

  const r = data as {
    id: string;
    name: string;
    emoji: string | null;
    color: string | null;
    price: string | number;
    stock: string | number;
    category_id: string | null;
    category_name: string | null;
    archivado: boolean;
    barcodes: string[] | null;
  };

  return {
    id: r.id,
    name: r.name,
    emoji: r.emoji,
    color: r.color,
    price: Number(r.price),
    stock: Number(r.stock),
    categoryId: r.category_id,
    categoryName: r.category_name,
    archivado: Boolean(r.archivado),
    barcodes: r.barcodes ?? [],
  };
}

/**
 * Búsqueda de productos server-side (escala Fase 2).
 *
 * Reemplaza el `.filter()` en memoria sobre el catálogo precargado. Busca por nombre
 * (contiene, sin acentos) y por código (empieza con), devuelve UNA página acotada y el
 * total real. Toda la cota y el gate viven en `productos_buscar`.
 */
export type ProductoBuscado = {
  id: string;
  name: string;
  emoji: string | null;
  color: string | null;
  price: number;
  cost: number | null;
  stock: number;
  lowStockThreshold: number | null;
  categoryId: string | null;
  categoryName: string | null;
  sold14d: number;
  /** Unidades vendidas en 30 días: alimenta la cobertura ("te dura 6 días"). */
  sold30d: number;
};

export type PaginaProductos = {
  items: ProductoBuscado[];
  total: number;
  limit: number;
  offset: number;
};

const buscarSchema = z.object({
  q: z.string().trim().max(80).nullable().optional(),
  // uuid = una categoría · "none" = el bucket "Sin categoría" (la deuda es filtrable).
  categoria: z.union([z.guid(), z.literal("none")]).nullable().optional(),
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).optional(),
});

export async function buscarProductos(input: unknown): Promise<PaginaProductos> {
  const session = await requireSession();
  const vacia: PaginaProductos = { items: [], total: 0, limit: 50, offset: 0 };

  const parsed = buscarSchema.safeParse(input ?? {});
  if (!parsed.success) return vacia;

  const supabase = await createSupabaseServer();
  const soloSinCategoria = parsed.data.categoria === "none";
  const { data, error } = await supabase.rpc("productos_buscar", {
    p_store_id: session.store.id,
    p_q: parsed.data.q?.trim() || null,
    p_categoria: soloSinCategoria ? null : (parsed.data.categoria ?? null),
    p_limit: parsed.data.limit ?? 50,
    p_offset: parsed.data.offset ?? 0,
    p_solo_sin_categoria: soloSinCategoria,
  });

  if (error || !data) return vacia;

  const r = data as {
    items: {
      id: string;
      name: string;
      emoji: string | null;
      color: string | null;
      price: string | number;
      cost: string | number | null;
      stock: string | number;
      low_stock_threshold: string | number | null;
      category_id: string | null;
      category_name: string | null;
      vendidas_14d: string | number;
      vendidas_30d: string | number;
    }[];
    total: number;
    limit: number;
    offset: number;
  };

  return {
    items: (r.items ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      emoji: p.emoji,
      color: p.color,
      price: Number(p.price),
      cost: p.cost === null ? null : Number(p.cost),
      stock: Number(p.stock),
      lowStockThreshold: p.low_stock_threshold === null ? null : Number(p.low_stock_threshold),
      categoryId: p.category_id,
      categoryName: p.category_name,
      sold14d: Number(p.vendidas_14d ?? 0),
      sold30d: Number(p.vendidas_30d ?? 0),
    })),
    total: Number(r.total ?? 0),
    limit: Number(r.limit ?? 50),
    offset: Number(r.offset ?? 0),
  };
}

/**
 * Clientes con saldo, bajo demanda (escala Fase 2). El POS precargaba ~300 clientes
 * en cada render para un `<select>` que solo se ve al elegir "Fiado".
 */
export type ClienteBuscado = { id: string; name: string; owed: number; creditLimit: number | null };

export async function buscarClientes(q?: string): Promise<ClienteBuscado[]> {
  const session = await requireSession();
  const supabase = await createSupabaseServer();

  const { data, error } = await supabase.rpc("clientes_buscar", {
    p_store_id: session.store.id,
    p_q: q?.trim() || null,
    p_limit: 50,
  });

  if (error || !data) return [];

  return (
    data as { id: string; name: string; owed: string | number; credit_limit: string | number | null }[]
  ).map((c) => ({
    id: c.id,
    name: c.name,
    owed: Number(c.owed ?? 0),
    creditLimit: c.credit_limit === null ? null : Number(c.credit_limit),
  }));
}

/** Alta rápida desde la caja: dos campos, menos de 10 segundos (PRD §4). */
const quickProductSchema = z.object({
  name: z.string().trim().min(1).max(80),
  price: z.number().nonnegative(),
  /* Costo dictado en el mostrador ("eso lo pago 900"): el kiosquero lo sabe de
     memoria y es lo que permite PROPONER el precio con el margen del negocio.
     Opcional: sin costo el producto se vende igual y queda en "sin costo". */
  cost: z.number().nonnegative().nullable().optional(),
  /* Conteo de góndola, OPCIONAL y casi siempre vacío: en la caja hay un cliente
     esperando. Si viene, deja el baseline de stock y el producto arranca con sus
     alertas encendidas (stock_confiable). */
  cantidad: z.number().nonnegative().nullable().optional(),
  barcode: z.string().trim().max(64).nullable().optional(),
  // Categoría EXISTENTE (escala Fase 1). Opcional: obligar a elegir haría que el
  // cajero invente categorías o abandone. Sin esto, todo lo dado de alta en la caja
  // caía en "Sin categoría" — la deuda que sabotea el agrupar por categoría.
  // OJO: acá NO se crean categorías nuevas (eso es Fase 2, con el índice único).
  category_id: z.guid().nullable().optional(),
  // Referencia del catálogo que el usuario eligió por nombre. Si viene, su
  // escaneo aporta el código real de un producto que nadie tenía mapeado.
  catalogoRef: z.string().trim().max(64).nullable().optional(),
});

export type QuickCreateResult =
  | {
      ok: true;
      id: string;
      name: string;
      price: number;
      /** El código ya existía: se devolvió el producto EXISTENTE, no se creó nada. */
      existing?: boolean;
      /** Se creó el producto pero su código no se pudo asociar (ya estaba en uso). */
      avisoCodigo?: string;
      /** ¿Quedó con baseline de góndola? false = se vende, pero sin alertas de stock. */
      stockConfiable?: boolean;
    }
  | { ok: false; error: string };

export async function quickCreateProduct(input: unknown): Promise<QuickCreateResult> {
  const session = await requireSession();

  if (!(session.member.role === "owner" || session.member.can_receive_stock)) {
    return { ok: false, error: "No tenés permiso para dar de alta productos." };
  }

  const parsed = quickProductSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Poné al menos nombre y precio." };
  }

  const supabase = await createSupabaseServer();

  /* Alta ATÓMICA (037): producto + código + asiento inicial opcional en una sola
     transacción. Antes eran 4 llamadas sueltas y cualquier corte dejaba basura:
     producto sin código, o con código de otro.

     El dedup vive adentro de la RPC: si el código YA es de un producto del
     negocio devuelve ESE (antes el insert chocaba contra `unique (store_id,
     barcode)` y el error no se miraba → duplicado con stock 0 para siempre). */
  const { data: creado, error } = await supabase.rpc("crear_producto_rapido", {
    p_store_id: session.store.id,
    p_nombre: parsed.data.name,
    p_precio: parsed.data.price,
    p_costo: parsed.data.cost ?? null,
    p_barcode: parsed.data.barcode ?? null,
    p_category_id: parsed.data.category_id ?? null,
    p_cantidad: parsed.data.cantidad ?? null,
  });

  if (error || !creado) {
    if (error?.message.includes("not_allowed")) {
      return { ok: false, error: "No tenés permiso para dar de alta productos." };
    }
    return { ok: false, error: "No pudimos guardar el producto." };
  }

  const data = creado as {
    id: string;
    name: string;
    price: string | number;
    existing?: boolean;
    stock_confiable?: boolean;
  };

  if (data.existing) {
    return { ok: true, id: data.id, name: data.name, price: Number(data.price), existing: true };
  }

  if (parsed.data.barcode) {
    // Aporte al catálogo compartido: si este código no estaba, ahora el próximo
    // kiosquero que lo escanee ya lo va a tener. Va SOLO el nombre — el precio y
    // las ventas nunca salen del negocio.
    if (parsed.data.catalogoRef) {
      // Eligió un producto por nombre: su escaneo es el código real que faltaba.
      await supabase.rpc("catalogo_vincular_ean", {
        p_ean: parsed.data.barcode,
        p_ean_o_nombre: parsed.data.catalogoRef,
      });
    } else {
      await supabase.rpc("catalogo_aportar", {
        p_ean: parsed.data.barcode,
        p_nombre: data.name,
        p_marca: null,
      });
    }
  }

  revalidatePath("/pos");
  return {
    ok: true,
    id: data.id,
    name: data.name,
    price: Number(data.price),
    stockConfiable: data.stock_confiable ?? false,
  };
}
