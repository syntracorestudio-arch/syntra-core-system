/**
 * Tests de la puerta de escaneo (Fcam).
 *
 * Corren con el runner nativo de Node (v24 tipa-y-borra TypeScript solo), así
 * que no suman ninguna dependencia al proyecto:
 *
 *   node --test src/components/pos/scan-gate.test.ts
 *
 * Lo que se prueba acá es la diferencia entre cobrar una Coca y cobrar cuatro.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { PuertaDeEscaneo } from "./scan-gate.ts";

const COCA = "7790895000997";
const AGUA = "7790895111888";

test("un solo frame NO alcanza: hace falta ver el código dos veces seguidas", () => {
  const p = new PuertaDeEscaneo();
  assert.equal(p.ver(COCA, 0), "ignorado");
  assert.equal(p.ver(COCA, 100), "aceptado");
});

test("dos códigos alternados no acumulan confirmaciones (cuadro con dos códigos)", () => {
  const p = new PuertaDeEscaneo();
  // El caso real: en el cuadro entran el EAN del producto y el de la góndola,
  // y el detector devuelve uno u otro según el frame.
  assert.equal(p.ver(COCA, 0), "ignorado");
  assert.equal(p.ver(AGUA, 100), "ignorado");
  assert.equal(p.ver(COCA, 200), "ignorado");
  assert.equal(p.ver(AGUA, 300), "ignorado");
  // Recién cuando uno se sostiene dos ciclos seguidos, se acepta.
  assert.equal(p.ver(AGUA, 400), "aceptado");
});

test("el mismo código dentro de los 700 ms se ignora", () => {
  const p = new PuertaDeEscaneo();
  p.ver(COCA, 0);
  assert.equal(p.ver(COCA, 100), "aceptado");

  // El producto sigue en cuadro después del beep: no se cobra de nuevo.
  assert.equal(p.ver(COCA, 200), "ignorado");
  assert.equal(p.ver(COCA, 300), "ignorado");
  assert.equal(p.ver(COCA, 699), "ignorado");
});

test("un código DISTINTO se acepta al instante (no espera el enfriamiento)", () => {
  const p = new PuertaDeEscaneo();
  p.ver(COCA, 0);
  assert.equal(p.ver(COCA, 100), "aceptado");

  // Segundo producto, 200 ms después: la venta no se frena.
  assert.equal(p.ver(AGUA, 200), "ignorado"); // primera confirmación
  assert.equal(p.ver(AGUA, 300), "aceptado");
});

test("volver a escanear a propósito después del enfriamiento SÍ suma", () => {
  const p = new PuertaDeEscaneo();
  p.ver(COCA, 0);
  assert.equal(p.ver(COCA, 100), "aceptado");

  // El cajero aleja el producto (ciclos sin lectura) y lo vuelve a pasar.
  p.ver(null, 400);
  p.ver(null, 500);
  assert.equal(p.ver(COCA, 900), "ignorado"); // primera confirmación
  assert.equal(p.ver(COCA, 1000), "aceptado");
});

test("dejar el producto QUIETO frente a la cámara no lo cobra de nuevo", () => {
  // El caso de las cuatro Cocas: sin esta regla, cada ventana de enfriamiento
  // sumaría una unidad mientras el producto siga apoyado en el mostrador.
  const p = new PuertaDeEscaneo();
  p.ver(COCA, 0);
  assert.equal(p.ver(COCA, 100), "aceptado");

  let aceptados = 0;
  for (let t = 200; t <= 5000; t += 100) {
    if (p.ver(COCA, t) === "aceptado") aceptados += 1;
  }
  assert.equal(aceptados, 0, "quedó quieto en cuadro: no se cobra una segunda vez");
});

test("ver otro código también cuenta como que el anterior salió del cuadro", () => {
  const p = new PuertaDeEscaneo();
  p.ver(COCA, 0);
  p.ver(COCA, 100); // aceptado

  p.ver(AGUA, 200);
  p.ver(AGUA, 300); // aceptado

  // Vuelve la Coca, pasado el enfriamiento: es una segunda unidad legítima.
  assert.equal(p.ver(COCA, 900), "ignorado");
  assert.equal(p.ver(COCA, 1000), "aceptado");
});

test("reiniciar borra el historial (escáner recién abierto)", () => {
  const p = new PuertaDeEscaneo();
  p.ver(COCA, 0);
  p.ver(COCA, 100); // aceptado

  p.reiniciar();
  assert.equal(p.ver(COCA, 150), "ignorado");
  assert.equal(p.ver(COCA, 200), "aceptado", "tras reiniciar no arrastra enfriamiento");
});

test("la ventana de enfriamiento es configurable", () => {
  const p = new PuertaDeEscaneo({ enfriamientoMs: 2000 });
  p.ver(COCA, 0);
  p.ver(COCA, 100); // aceptado
  p.ver(null, 200); // salió del cuadro
  p.ver(COCA, 900);
  assert.equal(p.ver(COCA, 1000), "ignorado", "todavía dentro de los 2 s");
  p.ver(null, 1100);
  p.ver(COCA, 2200);
  assert.equal(p.ver(COCA, 2300), "aceptado");
});
