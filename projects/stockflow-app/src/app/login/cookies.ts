/**
 * Nombres de las cookies del login.
 *
 * Viven en su propio módulo porque un archivo `"use server"` sólo puede
 * exportar funciones async: si estas constantes vivieran en `actions.ts`, el
 * build de Next falla (tsc no lo ve; el build sí).
 *
 * El kiosco se recuerda en COOKIE y no en `localStorage` porque la lee el
 * server component: así el PRIMER paint del login ya sale en el modo correcto,
 * sin flash ni mismatch de hidratación.
 */
export const COOKIE_KIOSCO = "sf_kiosco";

/** Sólo para saludar al terminal por su nombre. Nunca se usa para autenticar. */
export const COOKIE_KIOSCO_NOMBRE = "sf_kiosco_n";
