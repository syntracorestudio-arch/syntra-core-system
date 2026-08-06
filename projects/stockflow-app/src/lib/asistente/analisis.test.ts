/**
 * Tests del análisis estructurado — el reemplazo del párrafo suelto.
 *
 * Por qué estructurado y no prosa: en texto libre solo se pueden verificar los
 * NÚMEROS. Una afirmación sin cifras ("los gastos no afectaron la ganancia" en un
 * negocio que no cargó gastos) pasa igual, y ese es el error que más caro sale:
 * el dueño no tiene cómo detectarlo. Con campos, cada pieza se contrasta contra
 * un dato real — el producto tiene que existir, el precio tiene que ser EL que
 * calculó la app, el tipo de acción tiene que corresponder a una fuga que existe.
 *
 * Se corre con: node --test src/lib/asistente/analisis.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { verificarAnalisis, type Analisis } from "./analisis.ts";

/** Lo que la app calculó de verdad; el análisis se contrasta contra esto. */
const REAL = {
  numeros: [7505150, 2484108, 57910, 17100, 4950, 5850, 12, 33, 6, 5, 3, 59254, 60450, 250, 2000, 91],
  productos: ["Chesterfield 100g 8", "Ibuprofeno x6", "Coca 500ml"],
  fugas: ["remarcar", "stock_muerto", "fiado", "datos"] as const,
};

const bueno = (over: Partial<Analisis> = {}): Analisis => ({
  dolor: {
    titulo: "Vendés mucho de lo que menos te deja",
    porque: "Los cigarrillos son lo que más facturás y los vendés al 12% de margen.",
  },
  acciones: [
    {
      tipo: "remarcar",
      texto: "Subí Chesterfield 100g 8 de $4.950 a $5.850.",
      producto: "Chesterfield 100g 8",
      monto: 17100,
    },
  ],
  fuga: "Tenés $59.254 parados en productos que no se mueven hace más de 30 días.",
  huecos: "250 productos sin costo cargado: la ganancia real puede ser otra.",
  ...over,
});

const v = (a: Analisis) => verificarAnalisis(a, REAL);

// ── Lo que tiene que pasar ─────────────────────────────────────────────────────

test("un análisis con todo verificable pasa entero", () => {
  const r = v(bueno());
  assert.equal(r.ok, true);
  assert.equal(r.ok && r.analisis.acciones.length, 1);
});

// ── Lo que el texto libre NO podía atajar ──────────────────────────────────────

test("RECHAZA una acción sobre un producto que no existe", () => {
  const r = v(
    bueno({
      acciones: [{ tipo: "remarcar", texto: "Subí Marlboro Box a $6.000.", producto: "Marlboro Box", monto: 17100 }],
    }),
  );
  assert.equal(r.ok, false);
  assert.match(r.ok === false ? r.motivo : "", /producto/i);
});

test("RECHAZA un monto que la app nunca calculó", () => {
  const r = v(
    bueno({
      acciones: [
        { tipo: "remarcar", texto: "Subí Chesterfield 100g 8.", producto: "Chesterfield 100g 8", monto: 999999 },
      ],
    }),
  );
  assert.equal(r.ok, false);
  assert.match(r.ok === false ? r.motivo : "", /monto/i);
});

test("RECHAZA una fuga que este negocio no tiene", () => {
  const r = v(bueno({ acciones: [{ tipo: "merma", texto: "Revisá la merma.", producto: null, monto: null } as never] }));
  assert.equal(r.ok, false);
  assert.match(r.ok === false ? r.motivo : "", /tipo/i);
});

test("RECHAZA una cifra inventada en cualquier campo de texto, no solo en uno", () => {
  assert.equal(v(bueno({ fuga: "Perdés $9.900.000 por mes." })).ok, false);
  assert.equal(v(bueno({ huecos: "Te faltan 4.321 costos." })).ok, false);
  assert.equal(
    v(bueno({ dolor: { titulo: "Mal mes", porque: "Caíste 88% contra el mes pasado." } })).ok,
    false,
  );
});

// ── Quirúrgico donde conviene, estricto donde importa ──────────────────────────

test("una acción mala se cae sola; las buenas sobreviven", () => {
  const r = v(
    bueno({
      acciones: [
        { tipo: "remarcar", texto: "Subí Chesterfield 100g 8 a $5.850.", producto: "Chesterfield 100g 8", monto: 17100 },
        { tipo: "stock_muerto", texto: "Liquidá Marlboro Box.", producto: "Marlboro Box", monto: null },
        { tipo: "fiado", texto: "Salí a cobrar: son 3 clientes.", producto: null, monto: 60450 },
      ],
    }),
  );
  assert.equal(r.ok, true);
  assert.deepEqual(r.ok && r.analisis.acciones.map((a) => a.tipo), ["remarcar", "fiado"]);
});

test("si NINGUNA acción sobrevive, no hay análisis: un diagnóstico sin qué hacer no sirve", () => {
  const r = v(bueno({ acciones: [{ tipo: "remarcar", texto: "Subí X.", producto: "No Existe", monto: null }] }));
  assert.equal(r.ok, false);
});

test("el dolor es estricto: si falla, se cae todo aunque las acciones estén bien", () => {
  assert.equal(v(bueno({ dolor: { titulo: "x", porque: "Perdiste $1.234.567 este mes." } })).ok, false);
});

// ── Higiene ───────────────────────────────────────────────────────────────────

test("RECHAZA markup y links en cualquier campo", () => {
  assert.equal(v(bueno({ fuga: "Mirá <b>esto</b>." })).ok, false);
  assert.equal(v(bueno({ huecos: "Entrá a https://otro.com" })).ok, false);
});

test("RECHAZA campos vacíos o desmedidos", () => {
  assert.equal(v(bueno({ dolor: { titulo: "", porque: "algo" } })).ok, false);
  assert.equal(v(bueno({ fuga: "palabra ".repeat(120) })).ok, false);
});

test("los campos opcionales pueden faltar sin romper nada", () => {
  const r = v(bueno({ fuga: null, huecos: null }));
  assert.equal(r.ok, true);
});

test("un monto que viene como texto se normaliza, pero sigue teniendo que existir", () => {
  const conMonto = (monto: unknown) =>
    v(bueno({ acciones: [{ tipo: "fiado", texto: "Salí a cobrar.", producto: null, monto } as never] }));
  assert.equal(conMonto("$60.450").ok, true, "la forma se tolera");
  assert.equal(conMonto("60450").ok, true);
  assert.equal(conMonto("$99.999").ok, false, "el valor no");
  assert.equal(conMonto("un montón").ok, false);
});

test("un producto nombrado a medias es un producto inventado", () => {
  // Caso real: el modelo escribió "Chesterfield 1.5L", una variante que no existe
  // armada con la marca de un producto real. Manda al dueño a buscar fantasmas.
  const conTexto = (texto: string) =>
    v(bueno({ acciones: [{ tipo: "stock_muerto", texto, producto: null, monto: null }] }));
  assert.equal(conTexto("Liquidá Chesterfield 1.5L esta semana.").ok, false);
  assert.equal(conTexto("Liquidá Chesterfield 100g 8 esta semana.").ok, true, "el nombre completo pasa");
  assert.equal(conTexto("Liquidá lo que no rota esta semana.").ok, true, "sin nombrar producto, pasa");
});
