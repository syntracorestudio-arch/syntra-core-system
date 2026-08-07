import { money } from "./format.ts";

/**
 * Promos en la pantalla: el ÚNICO lugar que decide si una línea se muestra como
 * promo y cuánta plata representa.
 *
 * Por qué existe este módulo y no unas condiciones sueltas en el JSX: el precio
 * de promo lo resuelve el SERVIDOR (migración 045) y llega ya aplicado en
 * `price`. La pantalla sólo tiene que contar la misma historia que la caja. Si
 * el botón dice un número y el ticket dice otro, el cajero deja de confiar en el
 * sistema — y en una venta dividida, además, la venta se cae con
 * `split_sum_mismatch`.
 *
 * Nada de esto CALCULA el precio: eso ya pasó en SQL. Acá sólo se deriva qué
 * mostrar.
 */

/** Lo mínimo que necesita algo para poder mostrarse en promo. */
export type ConPromo = {
  /** Precio EFECTIVO (ya con la promo aplicada por el servidor). */
  price: number;
  /** Precio de lista congelado al crear la promo. null = no hay promo. */
  listPrice?: number | null;
  promoId?: string | null;
  /** Fecha de fin (YYYY-MM-DD). Lo que le permite al cajero decir hasta cuándo. */
  promoEndsOn?: string | null;
};

type LineaLike =
  | { tipo: "producto"; producto: ConPromo; cantidad: number }
  | { tipo: "libre"; cantidad: number };

/**
 * ¿Se muestra como promo?
 *
 * Exige las TRES cosas: id, precio de lista, y que ese precio sea realmente
 * mayor. Un `list_price` igual o menor sería un dato roto, y tachar un precio
 * que no bajó es peor que no mostrar nada: le enseña al cajero que el tachado
 * no significa nada.
 */
export function enPromo(p: ConPromo): boolean {
  return (
    p.promoId != null &&
    p.listPrice != null &&
    Number.isFinite(p.listPrice) &&
    p.listPrice > p.price
  );
}

/** Cuánto se ahorra por unidad. Sin promo: 0, nunca negativo. */
export function ahorroUnitario(p: ConPromo): number {
  return enPromo(p) ? p.listPrice! - p.price : 0;
}

/**
 * El delta que se muestra sobre el total en el paso de Confirmar.
 *
 * Va agregado y no por línea a propósito: en el confirm se lee el total, no las
 * líneas. Y va ahí y no en otro lado porque Confirmar es el instante exacto en
 * que se cuenta la plata — si el cajero canta el precio de la góndola de
 * memoria, la caja cierra con sobrante a la noche y nadie sabe por qué.
 */
export function ahorroCarrito(carrito: LineaLike[]): number {
  return carrito.reduce(
    (a, l) => (l.tipo === "producto" ? a + ahorroUnitario(l.producto) * l.cantidad : a),
    0,
  );
}

/** El "antes" tachado. null cuando no hay promo: la UI no debe renderizar nada. */
export function textoAntes(p: ConPromo): string | null {
  return enPromo(p) ? `antes ${money(p.listPrice!)}` : null;
}

const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"] as const;

/**
 * "hasta el vie 14" — la mitad de la frase que el cajero le dice al cliente.
 *
 * Sin la fecha, "está en promo" es una excusa; con la fecha es una explicación
 * que el cliente acepta sin repreguntar. Por eso vale una clave más en las RPCs.
 *
 * La fecha se parsea por COMPONENTES, no con `new Date("2026-08-01")`: ese
 * formato lo interpreta como UTC y en Argentina (UTC−3) mostraría el día
 * anterior. Un cartel con el día corrido es peor que no poner fecha.
 */
export function textoHasta(p: ConPromo): string | null {
  if (!enPromo(p) || !p.promoEndsOn) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(p.promoEndsOn);
  if (!m) return null;
  const [, y, mes, dia] = m;
  const d = new Date(Number(y), Number(mes) - 1, Number(dia));
  if (Number.isNaN(d.getTime()) || d.getDate() !== Number(dia)) return null;
  return `hasta el ${DIAS[d.getDay()]} ${d.getDate()}`;
}

/**
 * El renglón que va sobre el total en el pie: "Promo aplicada · −$600".
 *
 * Se arma acá y no en el JSX para que el copy tenga un solo dueño. Dos cosas
 * deliberadas:
 * - **"Promo aplicada", nunca "Descuento"**: descuento es OTRA cosa en este
 *   sistema — el `unit_price` manual que exige `can_apply_discount`. Mezclar las
 *   palabras mezcla dos permisos distintos.
 * - El signo es `−` (U+2212), el mismo que usa `signedPct`, no un guion ASCII.
 */
export function textoDelta(carrito: LineaLike[]): string | null {
  const a = ahorroCarrito(carrito);
  return a > 0 ? `Promo aplicada · −${money(a)}` : null;
}
