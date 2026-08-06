/**
 * catalogo.ts — verificación de las propuestas del asistente sobre el catálogo.
 *
 * Mismo principio que el remito (el modelo propone, el código valida, el dueño
 * confirma) con una vuelta de tuerca: acá el error NO se nota al confirmar.
 * Un nombre mal acortado o una categoría mal puesta se descubren meses después,
 * cuando alguien no encuentra el producto en el POS o un reporte por rubro
 * miente. Por eso lo que no se puede contrastar contra el catálogo real se
 * descarta ANTES de mostrarse: el dueño nunca ve una propuesta no verificada.
 */

export type ProductoOriginal = { id: string; name: string };
export type CategoriaDelNegocio = { id: string; name: string };

export type NombrePropuesto = { id: string; nombre: string };
export type NombreVerificado = { id: string; original: string; nombre: string };

export type CategoriaPropuesta = { id: string; categoria: string };
export type CategoriaVerificada = {
  id: string;
  producto: string;
  categoriaId: string;
  categoriaNombre: string;
};

const MAX_NOMBRE = 60;

/** Clave de comparación: "Coca 500ml" y "coca  500ML" son el mismo nombre. */
const clave = (s: string) => s.trim().toLocaleLowerCase("es-AR").replace(/\s+/g, " ");

/** Los tokens que llevan el TAMAÑO: "2.25 lt", "118 gr", "x6", "500ml". */
function tamanos(nombre: string): string[] {
  const t = nombre.toLocaleLowerCase("es-AR");
  const out = new Set<string>();
  for (const m of t.matchAll(/(\d+(?:[.,]\d+)?)\s*(l|lt|lts|litro?s?|ml|cc|g|gr|grs|gramos?|k|kg|kilos?)\b/g)) {
    out.add(m[1].replace(",", "."));
  }
  for (const m of t.matchAll(/\bx\s*(\d+)\b/g)) out.add(m[1]);
  return [...out];
}

/**
 * Filtra las propuestas de nombre corto.
 *
 * @param existentes nombres de OTROS productos del negocio: el acortado no puede
 * chocar con ninguno. Es la cota dura — dos productos con el mismo nombre en el
 * buscador del POS es exactamente el problema que el acortado venía a resolver.
 */
export function verificarNombres(
  propuestas: NombrePropuesto[],
  productos: ProductoOriginal[],
  existentes: string[],
): NombreVerificado[] {
  if (!Array.isArray(propuestas)) return [];

  const porId = new Map(productos.map((p) => [p.id, p]));
  // Los nombres ya tomados: los de otros productos + los que va aceptando esta misma tanda.
  const tomados = new Set(existentes.map(clave));
  const out: NombreVerificado[] = [];

  for (const p of propuestas) {
    if (!p || typeof p.id !== "string" || typeof p.nombre !== "string") continue;

    const original = porId.get(p.id);
    if (!original) continue; // producto que no está en la tanda: no se toca

    const nombre = p.nombre.trim().replace(/\s+/g, " ");
    if (nombre.length === 0 || nombre.length > MAX_NOMBRE) continue;
    if (/<[^>]+>|https?:\/\//i.test(nombre)) continue;

    // Si no acorta, no hay propuesta que confirmar.
    if (nombre.length >= original.name.trim().length) continue;

    /* El tamaño es lo que distingue dos presentaciones del mismo producto:
       "Coca Cola" a secas vuelve indistinguibles la de 2.25L y la de 500ml. */
    const delOriginal = tamanos(original.name);
    if (delOriginal.length > 0) {
      const delCorto = tamanos(nombre);
      if (!delOriginal.some((t) => delCorto.includes(t))) continue;
    }

    const k = clave(nombre);
    if (tomados.has(k)) continue; // colisión con otro producto o con la misma tanda

    tomados.add(k);
    out.push({ id: p.id, original: original.name, nombre });
  }
  return out;
}

/**
 * Filtra las propuestas de categoría. La categoría tiene que EXISTIR en el
 * negocio: crear rubros desde una sugerencia llenaría el catálogo de duplicados
 * ("Bebidas", "Bebidas sin alcohol", "Gaseosas"…) que después nadie limpia.
 */
export function verificarCategorias(
  propuestas: CategoriaPropuesta[],
  productos: ProductoOriginal[],
  categorias: CategoriaDelNegocio[],
): CategoriaVerificada[] {
  if (!Array.isArray(propuestas) || categorias.length === 0) return [];

  const porId = new Map(productos.map((p) => [p.id, p]));
  const porNombre = new Map(categorias.map((c) => [clave(c.name), c]));
  const vistos = new Set<string>();
  const out: CategoriaVerificada[] = [];

  for (const p of propuestas) {
    if (!p || typeof p.id !== "string" || typeof p.categoria !== "string") continue;
    if (vistos.has(p.id)) continue;

    const producto = porId.get(p.id);
    const categoria = porNombre.get(clave(p.categoria));
    if (!producto || !categoria) continue;

    vistos.add(p.id);
    out.push({
      id: p.id,
      producto: producto.name,
      categoriaId: categoria.id,
      categoriaNombre: categoria.name,
    });
  }
  return out;
}
