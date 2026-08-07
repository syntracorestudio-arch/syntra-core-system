import { test } from "node:test";
import assert from "node:assert/strict";

import {
  enPromo,
  ahorroUnitario,
  ahorroCarrito,
  textoAntes,
  textoHasta,
  textoDelta,
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
