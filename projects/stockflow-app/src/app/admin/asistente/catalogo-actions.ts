"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/session";
import { createSupabaseServer } from "@/lib/supabase/server";
import { proponerCategorias, proponerNombres } from "@/lib/asistente/proponer-catalogo";
import type { CategoriaVerificada, NombreVerificado } from "@/lib/asistente/catalogo";

/* Una tanda = una llamada al modelo. 40 productos entran cómodos en la respuesta
   y en la pantalla; más que eso el dueño deja de revisar y empieza a aceptar de
   corrido, que es justo lo que estas pantallas tienen que evitar. */
const TANDA = 40;
/* Los nombres de catálogo mayorista arrancan largos: abajo de esto ya se leen. */
const LARGO_MOLESTO = 28;

export type PropuestaNombres = { ok: true; nombres: NombreVerificado[] } | { ok: false; error: string };
export type PropuestaCategorias = { ok: true; categorias: CategoriaVerificada[] } | { ok: false; error: string };

/**
 * Propone nombres cortos para los productos con nombre largo.
 *
 * Los nombres del catálogo mayorista (SEPA) promedian 32 caracteres y llegan a
 * 62: en el POS se cortan y dos productos distintos se ven iguales. El modelo
 * propone, `verificarNombres` exige que conserve marca y tamaño y que no choque
 * con ningún otro producto del negocio, y el dueño confirma uno por uno.
 */
export async function sugerirNombresCortos(): Promise<PropuestaNombres> {
  const session = await requireOwner();
  const supabase = await createSupabaseServer();

  const { data: largos } = await supabase
    .from("products")
    .select("id, name")
    .eq("store_id", session.store.id)
    .eq("status", "active")
    .order("name")
    .limit(400);

  const candidatos = (largos ?? []).filter((p) => p.name.trim().length > LARGO_MOLESTO).slice(0, TANDA);
  if (candidatos.length === 0) {
    return { ok: false, error: "No encontramos nombres largos para acortar. Tu catálogo ya se lee bien." };
  }

  /* Todos los nombres del negocio, para que el acortado no choque con ninguno:
     es la cota dura del plan. Los de la tanda se excluyen — su propio nombre
     largo no es una colisión. */
  const enTanda = new Set(candidatos.map((c) => c.id));
  const existentes = (largos ?? []).filter((p) => !enTanda.has(p.id)).map((p) => p.name);

  return proponerNombres(candidatos, existentes);
}

/** Propone categoría para los productos que no tienen, entre las que ya existen. */
export async function sugerirCategorias(): Promise<PropuestaCategorias> {
  const session = await requireOwner();
  const supabase = await createSupabaseServer();

  const [{ data: sinCategoria }, { data: categorias }] = await Promise.all([
    supabase
      .from("products")
      .select("id, name")
      .eq("store_id", session.store.id)
      .eq("status", "active")
      .is("category_id", null)
      .order("name")
      .limit(TANDA),
    supabase.from("categories").select("id, name").eq("status", "active").order("name"),
  ]);

  if (!sinCategoria || sinCategoria.length === 0) {
    return { ok: false, error: "Todos tus productos ya tienen categoría." };
  }
  return proponerCategorias(sinCategoria, categorias ?? []);
}

// ── Aplicar lo confirmado ─────────────────────────────────────────────────────

const nombresSchema = z.object({
  cambios: z
    .array(z.object({ id: z.guid(), nombre: z.string().trim().min(1).max(60) }))
    .min(1, "Elegí al menos un nombre.")
    .max(TANDA),
});

/**
 * Aplica los nombres que el dueño confirmó.
 *
 * Va de a un UPDATE por producto y no en lote porque cada uno tiene su nombre:
 * son ≤40 filas por tanda, una vez. El filtro por `store_id` es explícito además
 * de la RLS — un id ajeno colado en el array no toca nada.
 */
export async function aplicarNombres(input: unknown): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const session = await requireOwner();
  const parsed = nombresSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisá los nombres." };
  }

  const supabase = await createSupabaseServer();
  let count = 0;
  for (const c of parsed.data.cambios) {
    const { data } = await supabase
      .from("products")
      .update({ name: c.nombre })
      .eq("id", c.id)
      .eq("store_id", session.store.id)
      .eq("status", "active")
      .select("id");
    count += (data ?? []).length;
  }

  if (count === 0) return { ok: false, error: "No pudimos guardar los nombres." };
  revalidatePath("/admin/productos");
  revalidatePath("/admin/asistente");
  revalidatePath("/pos");
  return { ok: true, count };
}
