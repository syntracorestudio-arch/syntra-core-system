/**
 * Tests de la lectura de remitos.
 *
 * La diferencia con el análisis: acá el modelo no describe, PROPONE ESCRITURAS
 * sobre el stock y los costos del negocio. Por eso las garantías son más duras:
 *
 *   · Ninguna línea entra sola. Todo lo que sale de acá es un BORRADOR que el
 *     operario confirma en la pantalla de siempre.
 *   · Cantidades y costos son números o no son nada: un "12 unidades" mal leído
 *     se convierte en stock fantasma que nadie va a auditar.
 *   · El match contra el catálogo lo hace el CÓDIGO (la búsqueda que ya existe),
 *     nunca el modelo: si el modelo eligiera el producto, un nombre parecido
 *     terminaría sumándole stock al equivocado.
 *
 * Se corre con: node --test src/lib/asistente/remito.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { normalizarLineas, prepararImagen, type LineaCruda } from "./remito.ts";

// ── Lo que el modelo devuelve, con toda la basura que devuelve de verdad ──────

test("normaliza cantidades y costos escritos a la argentina", () => {
  const l = normalizarLineas([
    { texto: "Coca 2.25L", cantidad: "12", costo: "$1.450,50" },
    { texto: "Alfajor Jorgito", cantidad: "6 u", costo: "890" },
  ]);
  assert.equal(l[0].cantidad, 12);
  assert.equal(l[0].costoUnitario, 1450.5);
  assert.equal(l[1].cantidad, 6);
  assert.equal(l[1].costoUnitario, 890);
});

test("una línea sin cantidad usable NO entra: el stock fantasma no se audita", () => {
  const l = normalizarLineas([
    { texto: "Producto ilegible", cantidad: "?", costo: "500" },
    { texto: "Otro", cantidad: "", costo: "500" },
    { texto: "Válido", cantidad: "3", costo: "500" },
  ]);
  assert.deepEqual(l.map((x) => x.texto), ["Válido"]);
});

test("el costo puede faltar — la cantidad no", () => {
  const l = normalizarLineas([{ texto: "Sin costo en el remito", cantidad: "4", costo: null }]);
  assert.equal(l.length, 1);
  assert.equal(l[0].costoUnitario, null);
});

test("descarta cantidades absurdas: un OCR que lee de más no carga 90.000 unidades", () => {
  const l = normalizarLineas([
    { texto: "Normal", cantidad: "24", costo: "100" },
    { texto: "Delirio", cantidad: "90000", costo: "100" },
    { texto: "Negativa", cantidad: "-5", costo: "100" },
  ]);
  assert.deepEqual(l.map((x) => x.texto), ["Normal"]);
});

test("descarta líneas sin texto: no hay contra qué buscar en el catálogo", () => {
  assert.equal(normalizarLineas([{ texto: "   ", cantidad: "5", costo: "10" }]).length, 0);
});

test("recorta la lista: un remito de 500 líneas no entra en una pantalla ni en un presupuesto", () => {
  const muchas = Array.from({ length: 200 }, (_, i) => ({
    texto: `Producto ${i}`,
    cantidad: "1",
    costo: "10",
  }));
  assert.equal(normalizarLineas(muchas).length, 60);
});

test("no confía en la forma: una respuesta rota devuelve lista vacía, no explota", () => {
  assert.deepEqual(normalizarLineas(null as unknown as LineaCruda[]), []);
  assert.deepEqual(normalizarLineas([{ nada: true }] as unknown as LineaCruda[]), []);
});

// ── La imagen que se manda ────────────────────────────────────────────────────

test("acepta una foto de remito y devuelve base64 + media type", async () => {
  const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
  const r = await prepararImagen(new File([jpg], "remito.jpg", { type: "image/jpeg" }));
  assert.equal(r.ok, true);
  assert.equal(r.ok && r.mediaType, "image/jpeg");
  assert.ok(r.ok && r.base64.length > 0);
});

test("RECHAZA lo que no es una imagen soportada", async () => {
  const r = await prepararImagen(new File([new Uint8Array([1])], "remito.pdf", { type: "application/pdf" }));
  assert.equal(r.ok, false);
  assert.match(r.ok === false ? r.error : "", /foto/i);
});

test("RECHAZA una foto demasiado pesada antes de gastar la llamada", async () => {
  const grande = new Uint8Array(6 * 1024 * 1024);
  const r = await prepararImagen(new File([grande], "gigante.jpg", { type: "image/jpeg" }));
  assert.equal(r.ok, false);
  assert.match(r.ok === false ? r.error : "", /pesada|grande/i);
});
