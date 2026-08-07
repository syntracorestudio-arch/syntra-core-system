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
  if (!enPromo(p)) return null;
  const corta = fechaCorta(p.promoEndsOn);
  return corta ? `hasta el ${corta}` : null;
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

/* ═══════════════════════════════════════════════════════════════════════════
   LA SECCIÓN (PR3)
   ═════════════════════════════════════════════════════════════════════════ */

const MESES = ["ene", "feb", "mar", "abr", "may", "jun",
               "jul", "ago", "sep", "oct", "nov", "dic"] as const;

/**
 * Parseo de `YYYY-MM-DD` POR COMPONENTES. Toda fecha de esta feature pasa por
 * acá: `new Date("2026-08-01")` la interpreta como UTC y en Argentina (UTC−3)
 * muestra el día anterior. En el POS eso era un texto corrido; en un cartel
 * impreso es un papel con el día equivocado pegado a la góndola una semana.
 */
export function parseFecha(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const [, y, mes, dia] = m;
  const d = new Date(Number(y), Number(mes) - 1, Number(dia));
  return Number.isNaN(d.getTime()) || d.getDate() !== Number(dia) ? null : d;
}

/** Fecha a `YYYY-MM-DD` en hora LOCAL (nunca `toISOString`, que pasa por UTC). */
export function aISO(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** "sáb 14" — para chips y renglones donde el mes se sobreentiende. */
export function fechaCorta(iso: string | null | undefined): string | null {
  const d = parseFecha(iso);
  return d ? `${DIAS[d.getDay()]} ${d.getDate()}` : null;
}

/** "sáb 14 de ago" — cuando la promo puede caer en otro mes. */
export function fechaLarga(iso: string | null | undefined): string | null {
  const d = parseFecha(iso);
  return d ? `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}` : null;
}

/** Días calendario entre dos `YYYY-MM-DD`. Negativo si `hasta` ya pasó. */
export function diasEntre(desde: string, hasta: string): number | null {
  const a = parseFecha(desde);
  const b = parseFecha(hasta);
  if (!a || !b) return null;
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/** Suma días a un `YYYY-MM-DD` sin salir del calendario local. */
export function sumarDias(iso: string, dias: number): string | null {
  const d = parseFecha(iso);
  if (!d) return null;
  d.setDate(d.getDate() + dias);
  return aISO(d);
}

/**
 * El piso de duración, espejo EXACTO de la regla de `create_promo` (047).
 *
 * Tres días, o hasta el vencimiento ligado, **lo que sea más corto**. El piso
 * frena el latigazo de precio: un precio que sube al otro día le enseña al
 * cliente que los carteles del negocio no valen. Pero cede ante el
 * vencimiento, porque liquidar algo que vence pasado mañana es medio motivo de
 * la feature — si no cediera, el caso más urgente sería el único imposible.
 *
 * Vive duplicado en TS a propósito: la RPC es la autoridad, esto existe para
 * que el dueño nunca llegue a un error. Los tests atan las dos mitades.
 */
export function finMinimo(startsOn: string, venceLote: string | null): string | null {
  const tresDias = sumarDias(startsOn, 2);
  if (!tresDias) return null;
  if (!venceLote || !parseFecha(venceLote)) return tresDias;
  return venceLote < tresDias ? venceLote : tresDias;
}

/** ¿El rango elegido cumple el piso? */
export function duracionValida(
  startsOn: string,
  endsOn: string,
  venceLote: string | null,
): boolean {
  const min = finMinimo(startsOn, venceLote);
  if (!min) return false;
  // Techo: una promo atada no puede sobrevivir al lote — pasada esa fecha
  // estaría liquidando la mercadería NUEVA al precio de la vieja.
  if (venceLote && parseFecha(venceLote) && endsOn > venceLote) return false;
  return endsOn >= min;
}

/**
 * Por qué el sistema movió (o rechazó) la fecha. Explicación, no error rojo:
 * el dueño tiene que entender la regla la primera vez y no volver a chocarla.
 */
export function razonDeDuracion(startsOn: string, venceLote: string | null): string {
  const min = finMinimo(startsOn, venceLote);
  const cortadaPorLote = !!(venceLote && min === venceLote && venceLote < (sumarDias(startsOn, 2) ?? ""));
  if (cortadaPorLote) {
    return `Menos de 3 días porque el lote vence el ${fechaCorta(venceLote)}.`;
  }
  return `Mínimo 3 días. Un precio que sube al otro día confunde al que vuelve el jueves.`;
}

/** Margen sobre el precio de venta, en enteros. Sin costo cargado: null. */
export function margenPct(precio: number, costo: number | null): number | null {
  if (costo === null || !Number.isFinite(costo) || precio <= 0) return null;
  return Math.round(((precio - costo) / precio) * 100);
}

/**
 * Los errores de las RPCs de promos, en el idioma del mostrador.
 *
 * Nunca se muestra el código crudo: `promo_overlap` no le dice nada a nadie, y
 * un error que no se entiende se lee como "el sistema está roto".
 */
const ERRORES: Record<string, string> = {
  not_allowed: "Solo el dueño puede poner promos.",
  promo_overlap: "Ese producto ya tiene una promo corriendo.",
  promo_too_short: "Una promo tiene que durar por lo menos 3 días.",
  promo_after_expiry: "La promo no puede durar más que el lote al que la atás.",
  below_cost: "Ese precio queda abajo de lo que te sale el producto.",
  invalid_amount: "El precio de promo tiene que ser menor al que tenés hoy.",
  invalid_range: "Revisá las fechas: la promo no puede arrancar antes de hoy.",
  product_not_found: "No encontramos ese producto.",
  expiry_not_found: "Ese vencimiento ya no está.",
  promo_not_found: "Esa promo ya no está.",
};

export function errorPromo(mensaje: string | null | undefined): string {
  if (!mensaje) return "No pudimos guardar la promo.";
  for (const [code, texto] of Object.entries(ERRORES)) {
    if (mensaje.includes(code)) return texto;
  }
  return "No pudimos guardar la promo.";
}
