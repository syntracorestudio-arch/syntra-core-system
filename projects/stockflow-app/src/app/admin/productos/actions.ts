"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase/server";
import { requireOwner, requireSession } from "@/lib/session";

export type ActionResult = { ok: true } | { ok: false; error: string };

const productSchema = z.object({
  name: z.string().trim().min(1, "Poné un nombre.").max(80),
  price: z.number().nonnegative(),
  cost: z.number().nonnegative().nullable(),
  emoji: z.string().trim().max(8).nullable(),
  category_id: z.guid().nullable(),
  low_stock_threshold: z.number().int().nonnegative().nullable(),
});

/**
 * Alta de producto. Acepta ADEMÁS el stock que el dueño ya tiene en la góndola y
 * su vencimiento, porque cuando alguien carga un producto nuevo lo tiene en la
 * mano: obligarlo a crearlo en cero y después ir a Ingreso es doble trabajo.
 */
const createSchema = productSchema.extend({
  initial_stock: z.number().nonnegative().nullable().optional(),
  expiry_date: z.string().nullable().optional(),
  barcode: z.string().trim().max(64).nullable().optional(),
});

export async function createProduct(input: unknown): Promise<ActionResult> {
  const session = await requireOwner();
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisá los datos." };
  }

  const { initial_stock, expiry_date, barcode, ...product } = parsed.data;
  const supabase = await createSupabaseServer();

  // El código de barras SÍ es identidad: si ya existe, es el mismo producto y no
  // hay ambigüedad posible. Acá sí bloqueamos (a diferencia del nombre parecido,
  // donde solo avisamos): duplicar por código parte el stock en dos fichas.
  if (barcode) {
    const { data: existente } = await supabase
      .from("product_barcodes")
      .select("product_id, products(name)")
      .eq("barcode", barcode)
      .maybeSingle();

    if (existente) {
      const nombre = (existente.products as unknown as { name: string } | null)?.name;
      return {
        ok: false,
        error: nombre
          ? `Ese código ya es de "${nombre}". Cargale stock desde Recibí mercadería.`
          : "Ese código de barras ya está en uso.",
      };
    }
  }

  const { data, error } = await supabase
    .from("products")
    .insert({
      store_id: session.store.id,
      ...product,
      emoji: product.emoji || "📦",
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: "No pudimos guardar el producto." };

  if (barcode) {
    await supabase.from("product_barcodes").insert({
      store_id: session.store.id,
      product_id: data.id,
      barcode,
    });
  }

  // El stock inicial entra por RPC, como todo movimiento: queda asentado en el
  // ledger con motivo 'initial' en vez de aparecer de la nada.
  if (initial_stock && initial_stock > 0) {
    await supabase.rpc("adjust_stock", {
      p_store_id: session.store.id,
      p_product_id: data.id,
      p_delta: initial_stock,
      p_reason: "initial",
      p_note: "carga inicial",
    });

    if (expiry_date) {
      await supabase.from("stock_expiries").insert({
        store_id: session.store.id,
        product_id: data.id,
        expiry_date,
        qty: initial_stock,
        created_by: session.member.id,
        note: "carga inicial",
      });
    }
  }

  revalidatePath("/admin/productos");
  revalidatePath("/admin/vencimientos");
  revalidatePath("/pos");
  return { ok: true };
}

export async function updateProduct(id: string, input: unknown): Promise<ActionResult> {
  await requireOwner();
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisá los datos." };
  }

  const supabase = await createSupabaseServer();
  // `stock` NO se toca acá: es un cache del ledger y sólo lo mueve el trigger.
  // Para corregirlo está `adjust_stock`, que deja el ajuste asentado.
  const { error } = await supabase
    .from("products")
    .update({ ...parsed.data, price_updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { ok: false, error: "No pudimos guardar los cambios." };
  revalidatePath("/admin/productos");
  revalidatePath("/pos");
  return { ok: true };
}

export async function archiveProduct(id: string): Promise<ActionResult> {
  await requireOwner();
  const supabase = await createSupabaseServer();
  // Archivar, nunca borrar: las ventas viejas tienen que seguir contando su historia.
  const { error } = await supabase.from("products").update({ status: "archived" }).eq("id", id);
  if (error) return { ok: false, error: "No pudimos archivar el producto." };
  revalidatePath("/admin/productos");
  revalidatePath("/pos");
  return { ok: true };
}

/** Ajuste manual de stock — pasa por RPC para que quede asentado en el ledger. */
export async function adjustStock(
  productId: string,
  delta: number,
  reason: "adjust" | "waste",
  note: string | null,
): Promise<ActionResult> {
  const session = await requireOwner();
  if (!delta || Number.isNaN(delta)) return { ok: false, error: "Poné una cantidad." };

  const supabase = await createSupabaseServer();
  const { error } = await supabase.rpc("adjust_stock", {
    p_store_id: session.store.id,
    p_product_id: productId,
    p_delta: delta,
    p_reason: reason,
    p_note: note,
  });

  if (error) {
    if (error.message.includes("invalid_delta")) {
      return { ok: false, error: "Una merma sólo puede restar." };
    }
    return { ok: false, error: "No pudimos ajustar el stock." };
  }
  revalidatePath("/admin/productos");
  revalidatePath("/pos");
  return { ok: true };
}

/**
 * Contar la góndola de un producto que nadie contó (puesta en marcha, 038).
 *
 * Se declara el TOTAL, no un delta: sobre un stock sin respaldo, "+10" no
 * significa nada. La RPC saca la diferencia, la asienta y el producto queda con
 * sus avisos de faltante encendidos. Si el conteo coincide, gradúa igual —
 * sin inventar un movimiento.
 */
export async function marcarStockContado(
  productId: string,
  total: number,
): Promise<ActionResult> {
  const session = await requireOwner();
  if (Number.isNaN(total) || total < 0) return { ok: false, error: "Poné cuántos tenés." };

  const supabase = await createSupabaseServer();
  const { error } = await supabase.rpc("marcar_stock_contado", {
    p_store_id: session.store.id,
    p_product_id: productId,
    p_total: total,
  });

  if (error) return { ok: false, error: "No pudimos guardar el conteo." };

  revalidatePath("/admin/productos");
  revalidatePath("/admin");
  revalidatePath("/pos");
  return { ok: true };
}

export type IngresoBuscado = {
  id: string;
  name: string;
  emoji: string | null;
  price: number;
  cost: number | null;
  stock: number;
  stockConfiable: boolean;
  archivado: boolean;
  barcodes: string[];
  ultimaCompra: { costo: number; fecha: string } | null;
};

/**
 * Buscar productos para recibir mercadería (escala F3).
 *
 * Reemplaza el precargado de 500 productos + 2000 códigos + 3000 asientos que
 * viajaba en cada request. `exacto` = escaneo: resuelve SOLO por código
 * completo, porque un parecido le suma la mercadería al producto equivocado.
 */
export async function buscarParaIngreso(
  q: string,
  exacto = false,
): Promise<IngresoBuscado[]> {
  const session = await requireSession();
  if (!(session.member.role === "owner" || session.member.can_receive_stock)) return [];

  const texto = q.trim();
  if (texto === "" || texto.length > 80) return [];

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.rpc("ingreso_buscar", {
    p_store_id: session.store.id,
    p_q: texto,
    p_limit: 8,
    p_exacto: exacto,
  });

  if (error || !data) return [];

  const r = data as {
    items: {
      id: string;
      name: string;
      emoji: string | null;
      price: string | number;
      cost: string | number | null;
      stock: string | number;
      stock_confiable?: boolean;
      archivado?: boolean;
      barcodes: string[] | null;
      ultima_compra: { costo: string | number; fecha: string } | null;
    }[];
  };

  return (r.items ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    emoji: p.emoji,
    price: Number(p.price),
    cost: p.cost === null || p.cost === undefined ? null : Number(p.cost),
    stock: Number(p.stock),
    // Ausente = confiable: ninguna pantalla debe inventar una advertencia.
    stockConfiable: p.stock_confiable ?? true,
    archivado: Boolean(p.archivado),
    barcodes: p.barcodes ?? [],
    ultimaCompra: p.ultima_compra
      ? { costo: Number(p.ultima_compra.costo), fecha: p.ultima_compra.fecha }
      : null,
  }));
}

/** Lo que hay que resolver cuando el escaneo trae un código que el negocio no tiene. */
export type CodigoDesconocido = {
  /** Nombre que propone el catálogo público (SEPA). null = tampoco lo conoce. */
  nombreCatalogo: string | null;
  /** Productos YA cargados, sin código, que podrían ser este mismo. */
  candidatos: { id: string; name: string; emoji: string | null; price: number; stock: number }[];
};

/**
 * Resuelve un código desconocido para poder darlo de alta AL RECIBIR.
 *
 * Dos consultas que van juntas siempre: el nombre del catálogo público, y —con
 * ese nombre— los productos que el negocio ya tiene SIN código y que podrían ser
 * el mismo. Sin ese segundo paso, un catálogo cargado a mano o importado de una
 * planilla se llena de gemelos: uno por cada producto que alguien escanee.
 */
export async function resolverCodigoDesconocido(barcode: string): Promise<CodigoDesconocido> {
  const session = await requireSession();
  const vacio: CodigoDesconocido = { nombreCatalogo: null, candidatos: [] };
  if (!(session.member.role === "owner" || session.member.can_receive_stock)) return vacio;

  const codigo = barcode.trim();
  if (!/^\d{8,14}$/.test(codigo)) return vacio;

  const supabase = await createSupabaseServer();
  const { data: enCatalogo } = await supabase.rpc("catalogo_buscar", { p_ean: codigo });
  const nombre = (enCatalogo as { nombre?: string } | null)?.nombre ?? null;

  if (!nombre) return vacio;

  const { data: parecidos } = await supabase.rpc("productos_sin_codigo_parecidos", {
    p_store_id: session.store.id,
    p_nombre: nombre,
    p_limit: 3,
  });

  const r = (parecidos ?? { items: [] }) as {
    items: { id: string; name: string; emoji: string | null; price: string | number; stock: string | number }[];
  };

  return {
    nombreCatalogo: nombre,
    candidatos: (r.items ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      emoji: p.emoji,
      price: Number(p.price),
      stock: Number(p.stock),
    })),
  };
}

/** Pegarle un código a un producto que ya existe (en vez de crear un gemelo). */
export async function vincularCodigo(productId: string, barcode: string): Promise<ActionResult> {
  const session = await requireSession();
  if (!(session.member.role === "owner" || session.member.can_receive_stock)) {
    return { ok: false, error: "No tenés permiso para tocar el catálogo." };
  }

  const supabase = await createSupabaseServer();
  const { error } = await supabase.rpc("vincular_codigo", {
    p_store_id: session.store.id,
    p_product_id: productId,
    p_barcode: barcode.trim(),
  });

  if (error) {
    if (error.message.includes("codigo_en_uso")) {
      return { ok: false, error: "Ese código ya es de otro producto." };
    }
    return { ok: false, error: "No pudimos asociar el código." };
  }

  revalidatePath("/admin/ingreso");
  revalidatePath("/admin/productos");
  revalidatePath("/pos");
  return { ok: true };
}

const repriceSchema = z.object({
  pct: z.number().refine((n) => n !== 0, "Poné un porcentaje distinto de cero."),
  category_id: z.guid().nullable(),
});

export async function bulkReprice(
  input: unknown,
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const session = await requireOwner();
  const parsed = repriceSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisá el porcentaje." };
  }

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.rpc("bulk_reprice", {
    p_store_id: session.store.id,
    p_pct: parsed.data.pct,
    p_category_id: parsed.data.category_id,
  });

  if (error) {
    if (error.message.includes("pct_out_of_range")) {
      return { ok: false, error: "Ese porcentaje es demasiado grande. Revisá el número." };
    }
    return { ok: false, error: "No pudimos remarcar." };
  }

  revalidatePath("/admin/productos");
  revalidatePath("/pos");
  return { ok: true, count: Number(data) };
}

const bulkCategorySchema = z.object({
  // Techo del baseline: nadie mueve 10.000 filas en un submit; el cliente
  // trocea de a 500 si la selección crece más que eso.
  product_ids: z.array(z.guid()).min(1, "Seleccioná al menos un producto.").max(500),
  category_id: z.guid().nullable(),
});

/**
 * Categorizar en masa: mueve la selección a una categoría (o la quita con null).
 * Nació para saldar la deuda "Sin categoría" del drill-down sin abrir la ficha
 * producto por producto.
 */
export async function bulkAssignCategory(
  input: unknown,
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const session = await requireOwner();
  const parsed = bulkCategorySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisá la selección." };
  }

  const supabase = await createSupabaseServer();

  // La categoría destino tiene que ser visible para ESTE negocio (RLS): el FK de
  // products no distingue tenants, así que lo validamos acá antes de escribir.
  if (parsed.data.category_id) {
    const { data: categoria } = await supabase
      .from("categories")
      .select("id")
      .eq("id", parsed.data.category_id)
      .eq("status", "active")
      .maybeSingle();
    if (!categoria) return { ok: false, error: "Esa categoría ya no existe." };
  }

  /* UPDATE por PK bajo RLS + filtro explícito de store: un id ajeno colado en el
     array no toca nada y tampoco infla el contador — devolvemos las filas que
     REALMENTE cambiaron, no las que pidió el cliente. */
  const { data, error } = await supabase
    .from("products")
    .update({ category_id: parsed.data.category_id })
    .in("id", parsed.data.product_ids)
    .eq("store_id", session.store.id)
    .eq("status", "active")
    .select("id");

  if (error) return { ok: false, error: "No pudimos mover los productos." };

  revalidatePath("/admin/productos");
  revalidatePath("/pos");
  return { ok: true, count: (data ?? []).length };
}

/** Ingreso de mercadería — sube stock, pisa el costo y registra vencimientos. */
const purchaseSchema = z.object({
  items: z
    .array(
      z.object({
        product_id: z.guid(),
        qty: z.number().positive(),
        unit_cost: z.number().nonnegative().nullable(),
        expiry_date: z.string().nullable(),
        /* Conteo al recibir (039): cuántos quedan EN TOTAL contando lo que
           llegó. Opcional — es lo único que convierte el stock de un producto
           que entró vendiendo en un número con respaldo. */
        total_gondola: z.number().nonnegative().nullable().optional(),
      }),
    )
    .min(1, "Cargá al menos un producto."),
});

export async function registerPurchase(
  input: unknown,
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const session = await requireSession();
  if (!(session.member.role === "owner" || session.member.can_receive_stock)) {
    return { ok: false, error: "No tenés permiso para cargar mercadería." };
  }

  const parsed = purchaseSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisá la carga." };
  }

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.rpc("register_purchase", {
    p_store_id: session.store.id,
    p_items: parsed.data.items,
  });

  if (error) return { ok: false, error: "No pudimos registrar el ingreso." };

  revalidatePath("/admin/productos");
  revalidatePath("/admin/ingreso");
  revalidatePath("/pos");
  return { ok: true, count: Number(data) };
}
