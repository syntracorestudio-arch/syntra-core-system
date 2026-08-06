/**
 * Tests de la capa de verdad del asistente: qué sale hacia el LLM (hechos.ts) y
 * qué se acepta de vuelta (verificarNarrativa).
 *
 * La regla que defienden: el modelo REDACTA, no calcula. Cualquier cifra que no
 * salga de los números ya computados se rechaza y el email cae a la plantilla.
 *
 * Se corre con: node --test src/lib/asistente/hechos.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { hechosDelReporte, valoresPermitidos, verificarNarrativa } from "./hechos.ts";
import type { Oportunidad, ReporteMensual } from "./composer.ts";

function oportunidad(over: Partial<Oportunidad> = {}): Oportunidad {
  return {
    tipo: "remarcar",
    titulo: "Remarcá precios que quedaron viejos",
    detalle: "L&M 1.5L y 5 productos más quedaron por debajo de tu margen.",
    monto: 87010,
    cantidad: 6,
    sujeto: "L&M 1.5L",
    ruta: "/admin/precios",
    cta: "Ver los 6 productos",
    ...over,
  };
}

function reporte(over: Partial<ReporteMensual> = {}): ReporteMensual {
  return {
    negocio: { nombre: "Kiosco Escala", rubro: "Kiosco", periodoLabel: "Julio de 2026", desde: "2026-07-01" },
    resumen: {
      facturado: 12480300,
      gananciaBruta: 3744090,
      gastos: 0,
      gananciaNeta: null,
      tieneGastos: false,
      coberturaCostoPct: 100,
      tickets: 842,
      vsMesAnteriorPct: -12,
      facturadoPrev: 14182160,
      mesAnteriorLabel: "junio",
    },
    oportunidades: [oportunidad()],
    detalle: {
      topGanancia: [{ nombre: "Coca 500ml", emoji: null, ganancia: 41200, unidades: 130 }],
      medios: [{ metodo: "Efectivo", total: 8000000 }],
      gastosPorCategoria: [],
    },
    alertas: { porVencer: [], stockBajo: [] },
    ...over,
  };
}

// ── Lo que sale del tenant ─────────────────────────────────────────────────────

test("los nombres de los clientes de fiado NO salen hacia el modelo", () => {
  const r = reporte({
    oportunidades: [
      oportunidad({
        tipo: "fiado",
        detalle: "3 clientes con deuda vieja. El más atrasado: Roberto Díaz, hace 61 días.",
        sujeto: "Roberto Díaz",
        monto: 43700,
        cantidad: 3,
      }),
    ],
  });
  const json = JSON.stringify(hechosDelReporte(r));
  assert.ok(!json.includes("Roberto"), `el payload nombra al deudor: ${json}`);
  assert.ok(!json.includes("Díaz"), json);
  // Pero el hecho sigue existiendo: son 3 clientes y $43.700.
  assert.equal(hechosDelReporte(r).oportunidades[0].cantidad, 3);
});

test("el nombre del negocio tampoco viaja: no aporta al análisis", () => {
  assert.ok(!JSON.stringify(hechosDelReporte(reporte())).includes("Kiosco Escala"));
});

test("los nombres de productos sí viajan: sin ellos el insight no se puede escribir", () => {
  const h = hechosDelReporte(reporte());
  assert.equal(h.oportunidades[0].sujeto, "L&M 1.5L");
  assert.equal(h.masVendidos[0].nombre, "Coca 500ml");
});

test("el margen se calcula acá, no lo estima el modelo", () => {
  assert.equal(hechosDelReporte(reporte()).mes.margenPct, 30);
});

test("sin facturación el margen es null, no una división por cero", () => {
  const r = reporte();
  r.resumen.facturado = 0;
  r.resumen.gananciaBruta = 0;
  assert.equal(hechosDelReporte(r).mes.margenPct, null);
});

test("la comparación contra el mes anterior viaja SIN ambigüedad", () => {
  /* Un `vsMesAnteriorPct: 75` pelado se lee de dos formas opuestas, y un modelo
     real leyó "quedó en el 75% del mes anterior" cuando en realidad SUBIÓ 75%.
     El verificador no lo puede atajar: 75 es una cifra legítima. Se arregla
     donde se origina — mandando la frase ya resuelta. */
  const h = hechosDelReporte(reporte());
  assert.equal(h.mes.vsMesAnterior, "bajó 12% contra junio");

  const r = reporte();
  r.resumen.vsMesAnteriorPct = 75;
  r.resumen.mesAnteriorLabel = "junio";
  assert.equal(hechosDelReporte(r).mes.vsMesAnterior, "subió 75% contra junio");
});

test("sin mes anterior no se inventa una comparación", () => {
  const r = reporte();
  r.resumen.vsMesAnteriorPct = null;
  r.resumen.mesAnteriorLabel = null;
  assert.equal(hechosDelReporte(r).mes.vsMesAnterior, null);
});

// ── La lista blanca de cifras ──────────────────────────────────────────────────

test("todo número citable sale de un valor ya computado", () => {
  const p = valoresPermitidos(reporte());
  for (const v of [12480300, 3744090, 842, 12, 14182160, 87010, 6, 41200, 130, 30]) {
    assert.ok(p.includes(v), `falta ${v} en la lista blanca`);
  }
});

// ── El verificador ─────────────────────────────────────────────────────────────

const permitidos = valoresPermitidos(reporte());
const ok = (texto: string) => verificarNarrativa(texto, permitidos).ok;

test("acepta las cifras exactas", () => {
  assert.ok(ok("Facturaste $12.480.300 en 842 ventas, un 12% menos que junio."));
});

test("acepta el redondeo honesto: 12.480.300 puede decirse 'casi 12,5 millones'", () => {
  assert.ok(ok("Facturaste casi 12,5 millones, un 12% menos que junio."));
});

test("RECHAZA un número que nadie computó", () => {
  const v = verificarNarrativa("Tenés $9.900.000 parados en el estante.", permitidos);
  assert.equal(v.ok, false);
  assert.match(v.ok === false ? v.motivo : "", /9900000/);
});

test("RECHAZA un redondeo que no redondea: 12.400.000 no es 12.480.300", () => {
  assert.equal(ok("Facturaste $12.400.000 este mes."), false);
});

test("RECHAZA un porcentaje inventado", () => {
  assert.equal(ok("El 47% de tus ventas fueron en efectivo."), false);
});

test("un nombre de producto con números no se lee como cifra inventada", () => {
  const v = verificarNarrativa("Coca 500ml y L&M 1.5L son los que más te dejaron.", permitidos, [
    "Coca 500ml",
    "L&M 1.5L",
  ]);
  assert.ok(v.ok, v.ok === false ? v.motivo : "");
});

test("acepta texto sin ninguna cifra", () => {
  assert.ok(ok("El mes se te fue en productos con precio viejo: eso es lo primero que mirar."));
});

test("acepta el año del período y la ventana de 30 días del producto", () => {
  assert.ok(ok("Desde julio de 2026 tenés productos sin vender hace más de 30 días."));
});

test("RECHAZA markup: el párrafo entra en un email HTML", () => {
  assert.equal(ok("Mirá <b>esto</b> con calma."), false);
  assert.equal(ok("Entrá a https://otro-sitio.com para ver más."), false);
});

test("RECHAZA un texto vacío o larguísimo", () => {
  assert.equal(ok("   "), false);
  assert.equal(ok("Palabra ".repeat(200)), false);
});

test("un producto nombrado sin su cola rara no dispara un falso positivo", () => {
  // El catálogo real trae nombres como "L&M 1.5L 1". El modelo escribe
  // "L&M 1.5L" y el "1.5" quedaba leyéndose como cifra inventada.
  const v = verificarNarrativa("Subí L&M 1.5L de precio esta semana ya mismo.", permitidos, ["L&M 1.5L 1"]);
  assert.ok(v.ok, v.ok === false ? v.motivo : "");
});
