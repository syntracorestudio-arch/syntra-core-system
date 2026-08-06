/**
 * enlaces.ts — de "acá tenés un problema" a "tocá acá y resolvelo".
 *
 * Una oportunidad sin próximo paso se lee y se olvida: el dueño abre el mail en
 * el celular, ve que hay $87.000 para recuperar y no tiene forma de actuar en ese
 * momento. Cada oportunidad aterriza en la pantalla que YA muestra exactamente
 * esos productos (Precios lista los erosionados; Reportes tiene el bloque de
 * stock parado; Fiado ordena por deuda vieja) — no hace falta filtro nuevo.
 *
 * Puro y sin dependencias a propósito: es la única lógica del reporte que puede
 * fallar en silencio (un link roto no tira error, simplemente nadie vuelve).
 */

export type TipoOportunidad = "remarcar" | "stock_muerto" | "fiado";

const ES_YMD = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Ruta relativa donde se resuelve cada oportunidad.
 *
 * `desde` es el primer día del período del reporte: el link a Reportes lo lleva
 * como fecha ABSOLUTA (?d=) para que abra el MISMO mes del que habla el email.
 * Sin eso, el mail de julio abriría los números de agosto y los montos no
 * coincidirían con lo que acaba de leer.
 */
export function rutaOportunidad(tipo: TipoOportunidad, ctx: { desde: string }): string {
  switch (tipo) {
    case "remarcar":
      return "/admin/precios";
    case "fiado":
      return "/admin/fiado";
    case "stock_muerto":
      return ES_YMD.test(ctx.desde)
        ? `/admin/reportes?p=mes&d=${ctx.desde}#stock-muerto`
        : "/admin/reportes#stock-muerto";
  }
}

/**
 * Convierte la ruta en URL absoluta usando la base de la app.
 *
 * Devuelve null si la base no está configurada o no es http(s): el reporte se
 * manda igual, sin botones. Un mail sin botón es peor que uno con botón; un mail
 * con un link a "undefined/admin/precios" es peor que los dos.
 */
/**
 * Dominios que viven horas: túneles de desarrollo y la máquina local. Un link a
 * uno de estos en el mail de un cliente es peor que no tener botón — hace clic,
 * le da error y deja de confiar en el resto del reporte.
 */
const EFIMERO = /localhost|127\.0\.0\.1|\.trycloudflare\.com|\.ngrok(-free)?\.(io|app|dev)|\.loca\.lt/i;

/** ¿La URL base es de un entorno pasajero? El cron lo avisa en los logs. */
export function baseEfimera(base: string | null | undefined): boolean {
  return EFIMERO.test((base ?? "").trim());
}

export function absolutizar(base: string | null | undefined, ruta: string): string | null {
  const limpia = (base ?? "").trim().replace(/\/+$/, "");
  if (!limpia) return null;
  if (!/^https?:\/\/[^/]+/i.test(limpia)) return null;
  return `${limpia}${ruta}`;
}

/**
 * Texto del botón. Lleva la cantidad adentro porque el número ES la razón para
 * tocarlo ("Ver los 6 productos" pesa más que "Ver detalle"). `sustantivo` viene
 * del rubro del negocio, así una farmacia no lee "productos".
 */
export function ctaOportunidad(tipo: TipoOportunidad, cantidad: number, sustantivo: string): string {
  if (!Number.isFinite(cantidad) || cantidad <= 0) return "Abrir StockFlow";

  const plural = sustantivo.trim() || "productos";
  const singular = plural.replace(/s$/, "");
  const uno = cantidad === 1;

  switch (tipo) {
    case "remarcar":
      return uno ? `Ver el ${singular}` : `Ver los ${cantidad} ${plural}`;
    case "stock_muerto":
      return uno ? `Ver el ${singular} parado` : `Ver los ${cantidad} ${plural} parados`;
    case "fiado":
      return uno ? "Ver el cliente" : `Ver los ${cantidad} clientes`;
  }
}
