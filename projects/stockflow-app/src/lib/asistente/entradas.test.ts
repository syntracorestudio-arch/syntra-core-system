/**
 * Tests del ensamblado de entradas — el contrato que evita el bug del "análisis
 * que degrada en silencio": si `armarEntradas` devuelve algo, ese algo alcanza
 * para que el análisis vea las fugas, la salud del dato y el ritmo del negocio.
 *
 * Se corre con: node --test src/lib/asistente/entradas.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { armarEntradas } from "./entradas.ts";
import { construirReporte } from "./composer.ts";
import { hechosDelReporte, verdadDelReporte } from "./hechos.ts";

/** Con la forma REAL de las RPCs (numeric como string incluido). */
const RESUMEN = {
  money: {
    sold: "7505150", tickets: 841, units: 1200, profit: "2484107.5", margin_pct: 33,
    cost_coverage: 91, prev_sold: "4298870", vs_prev_pct: 75,
  },
  period: { from: "2026-07-01", to: "2026-07-31", days: 31, days_of_use: 59 },
  top_profit: [{ name: "Chesterfield 100g 8", emoji: null, profit: "32917.5", units: 19, margin_pct: 35 }],
  dead_stock: { total: "59254", items: [{ name: "Ibuprofeno x6", emoji: null, stock: 12, parado: "19500" }] },
  credit: { given: "9250", collected: "0", overdue: [{ name: "Kiosco de la esquina", owed: "32800", dias: 62 }] },
  data_health: { cost_coverage: 91, products_without_cost: 250, stale_prices: 2000 },
  by_category: [{ name: "Cigarrillos", color: "#f59e0b", revenue: "1775150", profit: "621302.5" }],
  by_slot: [{ name: "Mañana", orden: 1, total: "3501840", tickets: 404 }],
  waste: { total: "0", items: [] },
};

const MEDIOS = { by_method: [{ method: "card", total: "2803610", count: 300 }], on_credit: "0" };
const GASTOS = { expenses: "0", expenses_by_category: [], expenses_loaded_ever: false };
const MARGENES = {
  min_margen: "25",
  redondeo: "50",
  total_por_mes: "57910",
  productos: [
    {
      name: "Chesterfield 100g 8", emoji: "🚬", precio: "4950", precio_sugerido: "5850",
      margen_hoy: 12, plata_por_mes: "17100", unidades_30d: 19,
    },
  ],
};
const ALERTAS = { low_stock: [{ name: "Coca 500ml", emoji: null, stock: 1 }], expiring: [] };

test("con las cuatro RPCs, el análisis ve fugas, salud del dato y ritmo", () => {
  const e = armarEntradas({ resumen: RESUMEN, medios: MEDIOS, gastos: GASTOS, margenes: MARGENES, alertas: ALERTAS });
  assert.ok(e, "tiene que ensamblar");

  const reporte = construirReporte(e.datos, e.alertas, e.margenes, {
    storeName: "K", vertical: "kiosco", from: "2026-07-01",
  });
  const h = hechosDelReporte(reporte, e.crudos);

  // Las tres cosas que separan un análisis de un resumen:
  assert.equal(h.fugas?.remarcar.productos[0].precioSugerido, 5850, "el precio sugerido tiene que viajar");
  assert.equal(h.saludDelDato?.productosSinCosto, 250, "la salud del dato también");
  assert.equal(h.ritmo?.categorias[0].nombre, "Cigarrillos", "y el ritmo por categoría");
  assert.ok(h.fugas!.ranking.length >= 2, "el ranking por plata al año existe");

  const verdad = verdadDelReporte(reporte, e.crudos);
  assert.deepEqual([...verdad.fugas].sort(), ["datos", "fiado", "remarcar", "stock_muerto"]);
});

test("las piezas opcionales pueden faltar sin romper el ensamblado", () => {
  const e = armarEntradas({ resumen: RESUMEN });
  assert.ok(e);
  assert.deepEqual(e.margenes.productos, []);
  assert.deepEqual(e.alertas.low_stock, []);
  // Y el reporte igual se construye:
  const r = construirReporte(e.datos, e.alertas, e.margenes, { storeName: "K", vertical: "kiosco", from: "2026-07-01" });
  assert.ok(r.resumen.facturado > 0);
});

test("sin resumen no hay entradas: mejor ningún análisis que uno vacío", () => {
  assert.equal(armarEntradas({ resumen: null }), null);
  assert.equal(armarEntradas({ resumen: undefined }), null);
});
