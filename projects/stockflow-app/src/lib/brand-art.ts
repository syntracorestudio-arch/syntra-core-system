/**
 * La familia de objetos de marca: vidrio casi-negro con aristas azules, primos
 * del isotipo. Viven en `public/art/` como WebP de 512² y se usan en DOS
 * lugares — el estado vacío de una pantalla y el watermark de su banda de
 * sección— así que el nombre y la ruta se definen una sola vez acá.
 *
 * No todas las piezas existen para los dos usos: `resumen`, `caja` y `ajustes`
 * son solo watermark (esas pantallas nunca están "vacías").
 */
export type BrandArt =
  | "productos"
  | "recibir"
  | "fiado"
  | "vencimientos"
  | "reportes"
  | "equipo"
  | "precios"
  | "resumen"
  | "caja"
  | "ajustes";

export const artSrc = (name: BrandArt) => `/art/${name}.webp`;
