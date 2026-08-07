import { test } from "node:test";
import assert from "node:assert/strict";

import {
  enPromo,
  ahorroUnitario,
  ahorroCarrito,
  textoAntes,
  textoHasta,
  textoDelta,
  parseFecha,
  aISO,
  fechaCorta,
  fechaLarga,
  diasEntre,
  sumarDias,
  finMinimo,
  duracionValida,
  razonDeDuracion,
  margenPct,
  errorPromo,
} from "./promos.ts";
import { money } from "./format.ts";

/* La plata que el cajero ve en pantalla sale de acá. Si estas funciones mienten,
   el botón dice un número y el ticket dice otro — que es exactamente la ruptura
   de confianza que la feature entera trata de evitar. */

const base = {
  id: "p1",
  name: "Alfajor",
  emoji: null,
  color: null,
  price: 700,
  stock: 10,
  categoryId: null,
  categoryName: null,
  barcodes: [],
  sold14d: 0,
};

const conPromo = { ...base, price: 700, listPrice: 1000, promoId: "pr1" };
const sinPromo = { ...base, price: 1000, listPrice: null, promoId: null };

test("enPromo: reconoce una promo real", () => {
  assert.equal(enPromo(conPromo), true);
});

test("enPromo: sin promo_id no hay promo", () => {
  assert.equal(enPromo(sinPromo), false);
});

test("enPromo: promo_id sin list_price NO es promo (no se puede tachar nada)", () => {
  assert.equal(enPromo({ ...base, promoId: "pr1", listPrice: null }), false);
});

test("enPromo: si el precio de lista no es MAYOR, no hay rebaja que mostrar", () => {
  // Defensa contra datos raros: nunca tachar un precio igual o menor.
  assert.equal(enPromo({ ...base, price: 1000, listPrice: 1000, promoId: "pr1" }), false);
  assert.equal(enPromo({ ...base, price: 1000, listPrice: 900, promoId: "pr1" }), false);
});

test("ahorroUnitario: la diferencia contra el precio de lista", () => {
  assert.equal(ahorroUnitario(conPromo), 300);
});

test("ahorroUnitario: sin promo es cero, nunca negativo", () => {
  assert.equal(ahorroUnitario(sinPromo), 0);
});

test("ahorroCarrito: suma por cantidad", () => {
  const carrito = [
    { tipo: "producto" as const, producto: conPromo, cantidad: 3 },
    { tipo: "producto" as const, producto: sinPromo, cantidad: 2 },
  ];
  assert.equal(ahorroCarrito(carrito), 900);
});

test("ahorroCarrito: el monto libre nunca aporta ahorro", () => {
  const carrito = [
    { tipo: "libre" as const, id: "l1", label: "Suelto", amount: 500, cantidad: 1 },
  ];
  assert.equal(ahorroCarrito(carrito), 0);
});

test("ahorroCarrito: carrito vacío = 0 (no NaN)", () => {
  assert.equal(ahorroCarrito([]), 0);
});

test("ahorroCarrito: mezcla producto en promo + monto libre", () => {
  const carrito = [
    { tipo: "producto" as const, producto: conPromo, cantidad: 1 },
    { tipo: "libre" as const, id: "l1", label: "Suelto", amount: 500, cantidad: 2 },
  ];
  assert.equal(ahorroCarrito(carrito), 300);
});

test("textoAntes: el 'antes' que lee el cajero", () => {
  // Se compara contra `money()` a propósito: el formato de pesos lo decide la
  // app en un solo lugar, y este texto tiene que seguirlo, no duplicarlo.
  assert.equal(textoAntes(conPromo), `antes ${money(1000)}`);
});

test("textoAntes: sin promo no hay texto que mostrar", () => {
  assert.equal(textoAntes(sinPromo), null);
});

/* ── Lo que el cajero lee en voz alta ─────────────────────────────────────── */

test("textoHasta: la fecha que convierte una excusa en explicación", () => {
  // 2026-08-14 cae viernes.
  assert.equal(textoHasta({ ...conPromo, promoEndsOn: "2026-08-14" }), "hasta el vie 14");
});

test("textoHasta: no se corre de día por zona horaria", () => {
  // Parsear "2026-08-01" como UTC daría 31/07 en Argentina (UTC-3).
  assert.equal(textoHasta({ ...conPromo, promoEndsOn: "2026-08-01" }), "hasta el sáb 1");
});

test("textoHasta: sin promo o sin fecha, no hay texto", () => {
  assert.equal(textoHasta({ ...sinPromo, promoEndsOn: "2026-08-14" }), null);
  assert.equal(textoHasta({ ...conPromo, promoEndsOn: null }), null);
});

test("textoHasta: una fecha basura no rompe la pantalla", () => {
  assert.equal(textoHasta({ ...conPromo, promoEndsOn: "no-es-fecha" }), null);
});

test("textoDelta: el renglón sobre el total", () => {
  const carrito = [{ tipo: "producto" as const, producto: conPromo, cantidad: 2 }];
  assert.equal(textoDelta(carrito), `Promo aplicada · −${money(600)}`);
});

test("textoDelta: sin ahorro no se muestra nada", () => {
  assert.equal(textoDelta([{ tipo: "producto" as const, producto: sinPromo, cantidad: 2 }]), null);
  assert.equal(textoDelta([]), null);
});

test("textoDelta: usa el menos tipográfico, no un guion", () => {
  const carrito = [{ tipo: "producto" as const, producto: conPromo, cantidad: 1 }];
  assert.ok(textoDelta(carrito)!.includes("−"), "debe usar U+2212 como signedPct");
  assert.ok(!textoDelta(carrito)!.includes("-"), "no debe usar guion ASCII");
});

test("textoDelta: nunca dice 'Descuento' (colisiona con can_apply_discount)", () => {
  const carrito = [{ tipo: "producto" as const, producto: conPromo, cantidad: 1 }];
  assert.ok(!/descuento/i.test(textoDelta(carrito)!));
});

/* ═══════════════════════════════════════════════════════════════════════════
   LA SECCIÓN — fechas y la regla de duración
   ═════════════════════════════════════════════════════════════════════════ */

test("parseFecha: por componentes, nunca UTC", () => {
  // `new Date("2026-08-01")` daría 31/07 en Argentina (UTC-3).
  const d = parseFecha("2026-08-01")!;
  assert.equal(d.getDate(), 1);
  assert.equal(d.getMonth(), 7);
  assert.equal(d.getFullYear(), 2026);
});

test("parseFecha: rechaza basura y fechas que no existen", () => {
  assert.equal(parseFecha("no-es-fecha"), null);
  assert.equal(parseFecha(null), null);
  assert.equal(parseFecha(""), null);
  assert.equal(parseFecha("2026-02-31"), null); // 31 de febrero
});

test("aISO: ida y vuelta sin pasar por UTC", () => {
  assert.equal(aISO(parseFecha("2026-08-01")!), "2026-08-01");
  assert.equal(aISO(new Date(2026, 0, 5)), "2026-01-05");
});

test("fechaCorta / fechaLarga", () => {
  assert.equal(fechaCorta("2026-08-14"), "vie 14");
  assert.equal(fechaLarga("2026-08-14"), "vie 14 de ago");
  assert.equal(fechaCorta("basura"), null);
});

test("sumarDias: cruza fin de mes y fin de año", () => {
  assert.equal(sumarDias("2026-08-30", 3), "2026-09-02");
  assert.equal(sumarDias("2026-12-31", 1), "2027-01-01");
  assert.equal(sumarDias("2026-08-14", 0), "2026-08-14");
});

test("diasEntre: cuenta días calendario", () => {
  assert.equal(diasEntre("2026-08-10", "2026-08-14"), 4);
  assert.equal(diasEntre("2026-08-14", "2026-08-14"), 0);
  assert.equal(diasEntre("2026-08-14", "2026-08-10"), -4);
});

/* La regla del owner: "mínimo 3 días O hasta el vencimiento, lo que sea MÁS
   CORTO". Estos son los mismos bordes que verifica verify-promos-047.sql
   contra la RPC — si las dos mitades se separan, el dueño se come un error que
   la pantalla debería haber evitado. */

test("finMinimo: sin lote atado, el piso son 3 días", () => {
  assert.equal(finMinimo("2026-08-10", null), "2026-08-12");
});

test("finMinimo: el lote lo acorta cuando vence antes", () => {
  // Vence en 2 días: la promo puede durar 2 días.
  assert.equal(finMinimo("2026-08-10", "2026-08-11"), "2026-08-11");
  // Vence HOY: una promo de un solo día es legítima.
  assert.equal(finMinimo("2026-08-10", "2026-08-10"), "2026-08-10");
});

test("finMinimo: un lote lejano NO estira el piso", () => {
  assert.equal(finMinimo("2026-08-10", "2026-09-30"), "2026-08-12");
});

test("duracionValida: 1 y 2 días sin lote no alcanzan; 3 sí", () => {
  assert.equal(duracionValida("2026-08-10", "2026-08-10", null), false);
  assert.equal(duracionValida("2026-08-10", "2026-08-11", null), false);
  assert.equal(duracionValida("2026-08-10", "2026-08-12", null), true);
});

test("duracionValida: EL BORDE — vence en 2 días ⇒ 2 días vale", () => {
  assert.equal(duracionValida("2026-08-10", "2026-08-11", "2026-08-11"), true);
});

test("duracionValida: con lote a 2 días, 1 día sigue siendo poco", () => {
  // El piso cede HASTA el vencimiento, no más allá.
  assert.equal(duracionValida("2026-08-10", "2026-08-10", "2026-08-11"), false);
});

test("duracionValida: techo — la promo no sobrevive al lote", () => {
  assert.equal(duracionValida("2026-08-10", "2026-08-20", "2026-08-14"), false);
  assert.equal(duracionValida("2026-08-10", "2026-08-14", "2026-08-14"), true);
});

test("razonDeDuracion: explica el caso corto por lote, no el genérico", () => {
  assert.match(razonDeDuracion("2026-08-10", "2026-08-11"), /vence el mar 11/);
  assert.match(razonDeDuracion("2026-08-10", null), /Mínimo 3 días/);
  // Lote lejano: la razón es el piso, no el lote.
  assert.match(razonDeDuracion("2026-08-10", "2026-09-30"), /Mínimo 3 días/);
});

test("margenPct: sobre el precio de venta, entero", () => {
  assert.equal(margenPct(1000, 600), 40);
  assert.equal(margenPct(1200, 860), 28);
  assert.equal(margenPct(500, 600), -20); // bajo costo: negativo, no null
  assert.equal(margenPct(1000, null), null);
  assert.equal(margenPct(0, 600), null);
});

test("errorPromo: traduce los códigos, nunca los muestra crudos", () => {
  assert.match(errorPromo("promo_overlap"), /ya tiene una promo/i);
  assert.match(errorPromo('new row violates ... "promo_too_short"'), /3 días/);
  assert.match(errorPromo("promo_after_expiry"), /más que el lote/);
  assert.match(errorPromo("below_cost"), /abajo de lo que te sale/);
  assert.match(errorPromo("not_allowed"), /Solo el dueño/);
  // Nunca se filtra el código al mostrador.
  for (const code of ["promo_overlap", "promo_too_short", "below_cost", "not_allowed"]) {
    assert.ok(!errorPromo(code).includes("_"), `"${code}" se filtró crudo`);
  }
  assert.equal(errorPromo("algo_que_no_conocemos"), "No pudimos guardar la promo.");
  assert.equal(errorPromo(null), "No pudimos guardar la promo.");
});
