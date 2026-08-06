/**
 * entradas.ts — arma las entradas del análisis desde los JSON de las RPCs.
 *
 * Existe por un bug que ya nos mordió: el cron llamaba a `narrarMes(reporte)` sin
 * los datos crudos y el análisis degradaba a repetir el email SIN que nada
 * fallara. Este módulo hace imposible ese olvido: devuelve las cuatro piezas
 * juntas (datos, alertas, margenes, crudos) o `null`, y quien llama no tiene que
 * acordarse de ensamblar nada.
 *
 * Lo usan los dos caminos de generación:
 *   · la server action de la página (RPCs del lado del DUEÑO, gateadas por RLS:
 *     el análisis ve exactamente lo que el dueño puede ver), y
 *   · los crons (RPCs service-role con impersonación, las mismas del email).
 */

import type { Alertas, DatosMensuales, Margenes } from "./composer.ts";
import type { Crudos } from "./hechos.ts";

export type EntradasAnalisis = {
  datos: DatosMensuales;
  alertas: Alertas;
  margenes: Margenes;
  crudos: Crudos;
};

export function armarEntradas(rpc: {
  /** JSON de `reportes_summary` (o el `resumen` de `asistente_datos_mensuales`). */
  resumen: unknown;
  /** JSON de `reportes_medios`. */
  medios?: unknown;
  /** JSON de `reportes_expenses` (owner-only; el que llama YA es owner). */
  gastos?: unknown;
  /** JSON de `margenes_erosionados` / `margenes_erosionados_core`. */
  margenes?: unknown;
  /** Listas de `store_alerts` o `dashboard_summary` (mismas claves). */
  alertas?: { low_stock?: unknown; expiring?: unknown } | null;
}): EntradasAnalisis | null {
  // Sin el resumen no hay nada que analizar; mejor ningún análisis que uno vacío.
  if (!rpc.resumen || typeof rpc.resumen !== "object") return null;

  const datos = {
    // La página no manda email: el destinatario es la pantalla del dueño.
    owner: { email: null, name: null },
    resumen: rpc.resumen,
    medios: rpc.medios ?? { by_method: [], on_credit: 0 },
    gastos: rpc.gastos ?? { expenses: 0, expenses_by_category: [], expenses_loaded_ever: false },
  } as DatosMensuales;

  const margenes = (rpc.margenes ?? { productos: [], total_por_mes: 0 }) as Margenes;
  const alertas = {
    low_stock: (rpc.alertas?.low_stock as Alertas["low_stock"]) ?? [],
    expiring: (rpc.alertas?.expiring as Alertas["expiring"]) ?? [],
  };

  return { datos, alertas, margenes, crudos: { datos, margenes } };
}
