/**
 * Tests de las propuestas sobre el catálogo (nombres cortos y categorías).
 *
 * Igual que el remito, acá el modelo propone ESCRITURAS. Pero con una diferencia
 * que endurece las reglas: un nombre mal acortado o una categoría mal puesta NO
 * se notan al confirmar — se notan meses después, cuando alguien no encuentra el
 * producto en el POS o un reporte por rubro miente. Por eso todo lo que no se
 * puede verificar contra el catálogo real se descarta antes de mostrarse.
 *
 * Se corre con: node --test src/lib/asistente/catalogo.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { verificarNombres, verificarCategorias, type ProductoOriginal } from "./catalogo.ts";

const PRODUCTOS: ProductoOriginal[] = [
  { id: "11111111-1111-4111-8111-111111111111", name: "GASEOSA COCA COLA SABOR ORIGINAL BOTELLA 2.25 LT" },
  { id: "22222222-2222-4222-8222-222222222222", name: "GALLETITAS OREO ORIGINAL PAQUETE 118 GR" },
  { id: "33333333-3333-4333-8333-333333333333", name: "Coca 500ml" },
];

// ── Nombres cortos ────────────────────────────────────────────────────────────

test("acepta un acortado que conserva marca y tamaño", () => {
  const r = verificarNombres(
    [{ id: PRODUCTOS[0].id, nombre: "Coca Cola 2.25L" }],
    PRODUCTOS,
    [],
  );
  assert.equal(r.length, 1);
  assert.equal(r[0].nombre, "Coca Cola 2.25L");
  assert.equal(r[0].original, PRODUCTOS[0].name);
});

test("RECHAZA un producto que no existe: el modelo no inventa filas", () => {
  assert.equal(verificarNombres([{ id: "99999999-9999-4999-8999-999999999999", nombre: "X" }], PRODUCTOS, []).length, 0);
});

test("RECHAZA el acortado que pierde el TAMAÑO: dos presentaciones se vuelven una", () => {
  // "Coca Cola" a secas no distingue la de 2.25L de la de 500ml en el POS.
  assert.equal(verificarNombres([{ id: PRODUCTOS[0].id, nombre: "Coca Cola" }], PRODUCTOS, []).length, 0);
});

test("RECHAZA el que colisiona con otro producto del negocio", () => {
  // Cota dura del plan: si el acortado da igual a un nombre que ya existe, no va.
  const r = verificarNombres(
    [{ id: PRODUCTOS[0].id, nombre: "coca 500ml" }],
    PRODUCTOS,
    ["Coca 500ml", "Alfajor Jorgito"],
  );
  assert.equal(r.length, 0);
});

test("RECHAZA el que no acorta nada", () => {
  assert.equal(verificarNombres([{ id: PRODUCTOS[2].id, nombre: "Coca 500ml de litro" }], PRODUCTOS, []).length, 0);
  assert.equal(verificarNombres([{ id: PRODUCTOS[2].id, nombre: "Coca 500ml" }], PRODUCTOS, []).length, 0);
});

test("RECHAZA vacíos, larguísimos y con markup", () => {
  const malos = [
    { id: PRODUCTOS[0].id, nombre: "  " },
    { id: PRODUCTOS[0].id, nombre: "x".repeat(90) },
    { id: PRODUCTOS[0].id, nombre: "<b>Coca 2.25L</b>" },
  ];
  assert.equal(verificarNombres(malos, PRODUCTOS, []).length, 0);
});

test("dos propuestas que colisionan ENTRE SÍ: solo entra la primera", () => {
  const dos = [
    { id: PRODUCTOS[0].id, nombre: "Coca 2.25L" },
    { id: PRODUCTOS[1].id, nombre: "coca 2.25 l" },
  ];
  const r = verificarNombres(dos, PRODUCTOS, []);
  assert.equal(r.length, 1);
  assert.equal(r[0].id, PRODUCTOS[0].id);
});

test("una respuesta rota no rompe nada", () => {
  assert.deepEqual(verificarNombres(null as never, PRODUCTOS, []), []);
  assert.deepEqual(verificarNombres([{ nada: 1 }] as never, PRODUCTOS, []), []);
});

// ── Categorías ────────────────────────────────────────────────────────────────

const CATEGORIAS = [
  { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name: "Bebidas" },
  { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", name: "Golosinas" },
];

test("acepta una categoría que existe en el negocio", () => {
  const r = verificarCategorias([{ id: PRODUCTOS[0].id, categoria: "Bebidas" }], PRODUCTOS, CATEGORIAS);
  assert.equal(r.length, 1);
  assert.equal(r[0].categoriaId, CATEGORIAS[0].id);
  assert.equal(r[0].categoriaNombre, "Bebidas");
});

test("RECHAZA una categoría inventada: no se crean rubros por sugerencia", () => {
  // Crear categorías desde el modelo llenaría el negocio de rubros duplicados.
  assert.equal(verificarCategorias([{ id: PRODUCTOS[0].id, categoria: "Bebidas sin alcohol" }], PRODUCTOS, CATEGORIAS).length, 0);
});

test("tolera mayúsculas y espacios al matchear la categoría", () => {
  const r = verificarCategorias([{ id: PRODUCTOS[1].id, categoria: "  golosinas " }], PRODUCTOS, CATEGORIAS);
  assert.equal(r.length, 1);
  assert.equal(r[0].categoriaId, CATEGORIAS[1].id);
});

test("RECHAZA un producto ajeno a la lista que se mandó", () => {
  assert.equal(
    verificarCategorias([{ id: "99999999-9999-4999-8999-999999999999", categoria: "Bebidas" }], PRODUCTOS, CATEGORIAS).length,
    0,
  );
});

test("sin categorías en el negocio no hay nada que proponer", () => {
  assert.equal(verificarCategorias([{ id: PRODUCTOS[0].id, categoria: "Bebidas" }], PRODUCTOS, []).length, 0);
});
