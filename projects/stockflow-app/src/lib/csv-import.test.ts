/**
 * Tests del lector de planillas.
 *
 *   node --test src/lib/csv-import.test.ts
 *
 * Los nombres y códigos que aparecen acá son REALES, tomados del catálogo SEPA
 * cargado localmente: preferimos probar contra datos que existen antes que
 * contra un archivo inventado que se porte bien.
 *
 * El test que más importa es el de los miles: `1.250` en una lista argentina son
 * mil doscientos cincuenta. Si el lector se equivoca, el kiosco carga toda la
 * góndola a un peso y vende a pérdida hasta que alguien lo note.
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  detectarSeparador,
  parsearFilas,
  detectarFilaEncabezado,
  sugerirMapeo,
  detectarFormatoNumerico,
  leerNumero,
  normalizarCodigo,
  armar,
  type Campo,
} from "./csv-import.ts";

/* Una lista de proveedor como las que se ven de verdad: título arriba, fecha,
   fila vacía, encabezado en la fila 4, punto y coma como separador (Excel en
   español), precios con punto de miles y coma decimal, y un total al final. */
const LISTA_PROVEEDOR = [
  "LISTA DE PRECIOS MAYORISTA;;;",
  "Vigente 03/2026;;;",
  ";;;",
  "CODIGO;DESCRIPCION;P. COSTO;PRECIO SUGERIDO",
  "7790040534506;Galletitas Arcor Formis Black 102 g;$ 1.250,00;$ 1.900,00",
  "7790411001606;Yerba Mate Rosamonte Zipper D/P250 g;2.480,50;3.700",
  "7793759320439;Gaseosa Cola Regular Rumipal x 2.25 L;1.100;1.650",
  ";;;",
  "TOTAL;;3;",
].join("\n");

test("detecta el punto y coma que deja Excel en español", () => {
  assert.equal(detectarSeparador(LISTA_PROVEEDOR), ";");
});

test("encuentra el encabezado aunque haya título y fecha arriba", () => {
  const filas = parsearFilas(LISTA_PROVEEDOR);
  assert.equal(detectarFilaEncabezado(filas), 3);
});

test("sugiere el mapeo de columnas por su nombre", () => {
  const filas = parsearFilas(LISTA_PROVEEDOR);
  const mapeo = sugerirMapeo(filas[3]);
  assert.deepEqual(mapeo, ["codigo", "nombre", "costo", "precio"]);
});

test('"P. COSTO" no se confunde con "PRECIO"', () => {
  // Si el costo ganara como precio, se vendería al costo: margen cero.
  const mapeo = sugerirMapeo(["DESCRIPCION", "P. COSTO", "PRECIO"]);
  assert.deepEqual(mapeo, ["nombre", "costo", "precio"]);
});

test("EL TEST QUE IMPORTA: 1.250 son mil doscientos cincuenta, no 1,25", () => {
  const fmt = detectarFormatoNumerico(["$ 1.250,00", "2.480,50", "1.100"]);
  assert.equal(fmt, "coma-decimal");
  assert.equal(leerNumero("$ 1.250,00", fmt), 1250);
  assert.equal(leerNumero("2.480,50", fmt), 2480.5);
  assert.equal(leerNumero("1.100", fmt), 1100);
});

test("una lista en formato inglés se lee bien igual", () => {
  const fmt = detectarFormatoNumerico(["1250.00", "2480.50", "1100"]);
  assert.equal(fmt, "punto-decimal");
  assert.equal(leerNumero("1250.00", fmt), 1250);
  assert.equal(leerNumero("2480.50", fmt), 2480.5);
});

test("el formato se decide por COLUMNA, no por celda suelta", () => {
  // "1.100" sola es ambigua; en una columna con "2.480,50" no lo es.
  const fmt = detectarFormatoNumerico(["1.100", "2.480,50"]);
  assert.equal(leerNumero("1.100", fmt), 1100);
});

test("precios sin datos no rompen: s/d, guión, vacío", () => {
  const fmt = detectarFormatoNumerico(["1.250,00", "s/d", "-", ""]);
  assert.equal(leerNumero("s/d", fmt), null);
  assert.equal(leerNumero("-", fmt), null);
  assert.equal(leerNumero("", fmt), null);
});

test("códigos: espacios y guiones se limpian, longitudes válidas 8-14", () => {
  assert.equal(normalizarCodigo("7790040534506").codigo, "7790040534506");
  assert.equal(normalizarCodigo(" 7790 0405 34506 ").codigo, "7790040534506");
  assert.equal(normalizarCodigo("7790-040-534506").codigo, "7790040534506");
  assert.equal(normalizarCodigo("12345").codigo, null, "muy corto: código interno");
});

test("el código que Excel arruinó se marca ILEGIBLE, no se inventa", () => {
  // 7.79E+12 perdió los últimos dígitos para siempre. Reconstruirlo sería
  // adivinar, y un código adivinado le vende un producto por otro.
  const r = normalizarCodigo("7.79E+12");
  assert.equal(r.codigo, null);
  assert.equal(r.roto, true);
});

test("armar: la lista de proveedor entra completa y el TOTAL se descarta", () => {
  const filas = parsearFilas(LISTA_PROVEEDOR);
  const enc = detectarFilaEncabezado(filas);
  const mapeo = sugerirMapeo(filas[enc]) as Campo[];
  const res = armar(filas, enc, mapeo);

  assert.equal(res.productos.length, 3);
  assert.equal(res.productos[0].nombre, "Galletitas Arcor Formis Black 102 g");
  assert.equal(res.productos[0].costo, 1250);
  assert.equal(res.productos[0].precio, 1900);
  assert.equal(res.productos[0].codigo, "7790040534506");

  assert.equal(res.rechazos.length, 1);
  assert.equal(res.rechazos[0].motivo, "fila de total");
});

test("un código repetido dentro del archivo entra una sola vez", () => {
  const csv = [
    "CODIGO,DESCRIPCION,PRECIO",
    "7790040534506,Galletitas Formis,1900",
    "7790040534506,Galletitas Formis (repetida),1900",
  ].join("\n");
  const filas = parsearFilas(csv);
  const res = armar(filas, 0, sugerirMapeo(filas[0]) as Campo[]);

  assert.equal(res.codigosDuplicados, 1);
  assert.equal(res.productos.filter((p) => p.codigo !== null).length, 1);
  // La segunda igual se carga: es un producto, solo que sin quedarse el código.
  assert.equal(res.productos.length, 2);
});

test("una fila sin nada usable se rechaza CONTADA, no en silencio", () => {
  const csv = ["DESCRIPCION,PRECIO", "Producto sin precio,", "Otro,1500"].join("\n");
  const filas = parsearFilas(csv);
  const res = armar(filas, 0, sugerirMapeo(filas[0]) as Campo[]);

  assert.equal(res.productos.length, 1);
  assert.equal(res.rechazos.length, 1);
  assert.equal(res.rechazos[0].fila, 2, "el número de fila es el que se ve en Excel");
});

test("una fila SIN precio pero CON código entra igual (la identidad sirve)", () => {
  const csv = ["CODIGO,DESCRIPCION,PRECIO", "7790411001606,Yerba Rosamonte,"].join("\n");
  const filas = parsearFilas(csv);
  const res = armar(filas, 0, sugerirMapeo(filas[0]) as Campo[]);
  assert.equal(res.productos.length, 1);
  assert.equal(res.productos[0].precio, null);
});

test("nombres con coma no rompen el archivo separado por comas", () => {
  const csv = ['DESCRIPCION,PRECIO', '"Galletitas surtidas, chocolate",1900'].join("\n");
  const filas = parsearFilas(csv);
  assert.equal(filas[1][0], "Galletitas surtidas, chocolate");
  assert.equal(filas[1][1], "1900");
});

test("sin encabezado reconocible devuelve -1 (lo elige la persona)", () => {
  const csv = ["Cosa rara;otra cosa", "algo;1200"].join("\n");
  assert.equal(detectarFilaEncabezado(parsearFilas(csv)), -1);
});
