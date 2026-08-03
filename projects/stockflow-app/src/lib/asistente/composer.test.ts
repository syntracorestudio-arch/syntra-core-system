/**
 * Tests del composer — la regla que se verificó rompiendo el link en el navegador:
 * el reporte NO puede ofrecer una oportunidad que la app todavía esconde.
 *
 * Se corre con: node --test src/lib/asistente/composer.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { construirReporte, type Alertas, type DatosMensuales, type Margenes } from "./composer.ts";

const META = { storeName: "Kiosco Escala", vertical: "kiosco", from: "2026-07-01" };
const SIN_ALERTAS: Alertas = { low_stock: [], expiring: [] };
const SIN_MARGENES: Margenes = { productos: [], total_por_mes: 0 };

function datos(over: { diasDeUso?: number | null; muerto?: number } = {}): DatosMensuales {
  const period = over.diasDeUso === undefined
    ? { days_of_use: 90 }
    : over.diasDeUso === null
      ? {}
      : { days_of_use: over.diasDeUso };
  return {
    owner: { email: "dueno@escala.test", name: "Mati" },
    resumen: {
      money: {
        sold: 1000, tickets: 10, units: 20, profit: 300, margin_pct: 30,
        cost_coverage: 1, prev_sold: 0, vs_prev_pct: null,
      },
      period,
      top_profit: [],
      dead_stock: {
        total: over.muerto ?? 59254,
        items: [{ name: "Ibuprofeno x6", emoji: null, stock: 3, parado: 12000 }],
      },
      credit: { given: 0, collected: 0, overdue: [] },
    },
    medios: { by_method: [], on_credit: 0 },
    gastos: { expenses: 0, expenses_by_category: [], expenses_loaded_ever: false },
  } as DatosMensuales;
}

const tipos = (d: DatosMensuales, m: Margenes = SIN_MARGENES) =>
  construirReporte(d, SIN_ALERTAS, m, META).oportunidades.map((o) => o.tipo);

// ── La regla nueva ─────────────────────────────────────────────────────────────

test("con menos de 30 días de uso NO se ofrece stock muerto: Reportes todavía lo esconde", () => {
  // Un negocio de 14 días no tiene 'productos parados': tiene productos nuevos.
  assert.deepEqual(tipos(datos({ diasDeUso: 14 })), []);
});

test("a los 30 días de uso sí se ofrece", () => {
  assert.deepEqual(tipos(datos({ diasDeUso: 30 })), ["stock_muerto"]);
});

test("si la RPC no informa los días, no se pierde la oportunidad", () => {
  assert.deepEqual(tipos(datos({ diasDeUso: null })), ["stock_muerto"]);
});

test("la cota es solo para stock muerto: remarcar no depende de la antigüedad", () => {
  const margenes: Margenes = {
    productos: [{ name: "L&M 1.5L", emoji: null, plata_por_mes: 87010 }],
    total_por_mes: 87010,
  };
  assert.deepEqual(tipos(datos({ diasDeUso: 5 }), margenes), ["remarcar"]);
});

// ── Fiado ──────────────────────────────────────────────────────────────────────

/** La RPC ordena la deuda por ANTIGÜEDAD (dias desc), no por monto. */
function conFiado(over: { name: string; owed: number; dias: number }[]): DatosMensuales {
  const d = datos();
  d.resumen.credit = { given: 0, collected: 0, overdue: over };
  d.resumen.dead_stock = { total: 0, items: [] };
  return d;
}

test("el texto no puede llamar 'el mayor' al primero: viene ordenado por días, no por plata", () => {
  const r = construirReporte(
    conFiado([
      { name: "Roberto Díaz", owed: 900, dias: 61 }, // el más VIEJO, pero el que menos debe
      { name: "Kiosco de la esquina", owed: 42800, dias: 33 },
    ]),
    SIN_ALERTAS,
    SIN_MARGENES,
    META,
  );
  const o = r.oportunidades[0];
  assert.ok(!o.detalle.includes("El mayor"), `no debe decir "El mayor": ${o.detalle}`);
  assert.ok(o.detalle.includes("Roberto Díaz"), o.detalle);
  assert.equal(o.monto, 43700); // la plata es la suma de TODA la deuda vieja
  assert.equal(o.cta, "Ver los 2 clientes");
  assert.equal(o.ruta, "/admin/fiado");
});

test("un solo deudor se nombra sin contarlo", () => {
  const r = construirReporte(
    conFiado([{ name: "Marta González", owed: 18400, dias: 47 }]),
    SIN_ALERTAS,
    SIN_MARGENES,
    META,
  );
  assert.equal(r.oportunidades[0].detalle, "Marta González debe hace 47 días.");
  assert.equal(r.oportunidades[0].cta, "Ver el cliente");
});

// ── Comparación contra el mes anterior ─────────────────────────────────────────

function conPrevio(prevSold: number, vsPct: number | null): DatosMensuales {
  const d = datos();
  d.resumen.money = { ...d.resumen.money, prev_sold: prevSold, vs_prev_pct: vsPct };
  d.resumen.dead_stock = { total: 0, items: [] };
  return d;
}

const resumenDe = (d: DatosMensuales, from = "2026-07-01") =>
  construirReporte(d, SIN_ALERTAS, SIN_MARGENES, { ...META, from }).resumen;

test("el mes de comparación se nombra: 'junio' dice más que 'mes anterior'", () => {
  const r = resumenDe(conPrevio(13400000, -12));
  assert.equal(r.mesAnteriorLabel, "junio");
  assert.equal(r.vsMesAnteriorPct, -12);
  assert.equal(r.facturadoPrev, 13400000);
});

test("enero compara contra diciembre del año pasado", () => {
  assert.equal(resumenDe(conPrevio(500, 10), "2026-01-01").mesAnteriorLabel, "diciembre");
});

test("el primer mes del negocio no inventa una comparación", () => {
  const r = resumenDe(conPrevio(0, null));
  assert.equal(r.vsMesAnteriorPct, null);
  assert.equal(r.mesAnteriorLabel, null);
});

// ── Que el botón exista y apunte bien ──────────────────────────────────────────

test("cada oportunidad viaja con su pantalla y su botón", () => {
  const r = construirReporte(datos(), SIN_ALERTAS, SIN_MARGENES, META);
  const o = r.oportunidades[0];
  assert.equal(o.ruta, "/admin/reportes?p=mes&d=2026-07-01#stock-muerto");
  assert.equal(o.cta, "Ver el producto parado");
  assert.equal(o.cantidad, 1);
});

test("el reporte lleva el primer día del período para que los links abran ESE mes", () => {
  assert.equal(construirReporte(datos(), SIN_ALERTAS, SIN_MARGENES, META).negocio.desde, "2026-07-01");
});
