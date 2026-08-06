/**
 * Tests de las dos propuestas de catálogo. Lo que garantizan: nada llega a la
 * pantalla sin pasar por el verificador, y ningún fallo del modelo deja al dueño
 * sin poder seguir editando a mano.
 *
 * Se corre con: node --test src/lib/asistente/proponer-catalogo.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { proponerCategorias, proponerNombres } from "./proponer-catalogo.ts";

const P = [
  { id: "11111111-1111-4111-8111-111111111111", name: "GASEOSA COCA COLA SABOR ORIGINAL BOTELLA 2.25 LT" },
  { id: "22222222-2222-4222-8222-222222222222", name: "GALLETITAS OREO ORIGINAL PAQUETE 118 GR" },
];
const CATS = [
  { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name: "Bebidas" },
  { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", name: "Golosinas" },
];
const ANTHROPIC = { nombre: "anthropic" as const, url: "https://x/y", apiKey: "k", modelo: "claude-haiku-4-5" };

function api(texto: string, status = 200) {
  const llamadas: RequestInit[] = [];
  const fetchImpl = (async (_u: unknown, init?: RequestInit) => {
    llamadas.push(init ?? {});
    return new Response(JSON.stringify({ content: [{ type: "text", text: texto }] }), { status });
  }) as unknown as typeof fetch;
  return { llamadas, fetchImpl };
}

// ── Nombres ───────────────────────────────────────────────────────────────────

test("devuelve solo los nombres que pasaron el verificador", () => {
  const respuesta = JSON.stringify({
    nombres: [
      { id: P[0].id, nombre: "Coca Cola 2.25L" },
      { id: P[1].id, nombre: "Oreo" }, // pierde el tamaño → se cae
    ],
  });
  const { fetchImpl } = api(respuesta);
  return proponerNombres(P, [], { proveedor: ANTHROPIC, fetchImpl }).then((r) => {
    assert.equal(r.ok, true);
    assert.equal(r.ok && r.nombres.length, 1);
    assert.equal(r.ok && r.nombres[0].nombre, "Coca Cola 2.25L");
  });
});

test("el prompt lleva los productos con su id", async () => {
  const { llamadas, fetchImpl } = api(JSON.stringify({ nombres: [{ id: P[0].id, nombre: "Coca Cola 2.25L" }] }));
  await proponerNombres(P, [], { proveedor: ANTHROPIC, fetchImpl });
  const body = JSON.parse(String(llamadas[0].body));
  assert.match(body.messages[0].content, /11111111-1111-4111-8111-111111111111/);
  assert.match(body.system, /marca y el tamaño/i);
});

test("si nada pasa el verificador, lo dice en vez de devolver lista vacía", async () => {
  const { fetchImpl } = api(JSON.stringify({ nombres: [{ id: P[0].id, nombre: "Coca Cola" }] }));
  const r = await proponerNombres(P, [], { proveedor: ANTHROPIC, fetchImpl });
  assert.equal(r.ok, false);
});

test("una lista vacía de productos no gasta una llamada", async () => {
  let llamado = false;
  const fetchImpl = (async () => {
    llamado = true;
    return new Response("{}", { status: 200 });
  }) as unknown as typeof fetch;
  const r = await proponerNombres([], [], { proveedor: ANTHROPIC, fetchImpl });
  assert.equal(r.ok, true);
  assert.equal(llamado, false);
});

// ── Categorías ────────────────────────────────────────────────────────────────

test("mapea la categoría propuesta a su id real", async () => {
  const { fetchImpl } = api(JSON.stringify({ categorias: [{ id: P[0].id, categoria: "Bebidas" }] }));
  const r = await proponerCategorias(P, CATS, { proveedor: ANTHROPIC, fetchImpl });
  assert.equal(r.ok, true);
  assert.equal(r.ok && r.categorias[0].categoriaId, CATS[0].id);
});

test("una categoría inventada se descarta y lo dice", async () => {
  const { fetchImpl } = api(JSON.stringify({ categorias: [{ id: P[0].id, categoria: "Gaseosas" }] }));
  const r = await proponerCategorias(P, CATS, { proveedor: ANTHROPIC, fetchImpl });
  assert.equal(r.ok, false);
});

test("sin categorías creadas no se llama al modelo: no hay dónde clasificar", async () => {
  let llamado = false;
  const fetchImpl = (async () => {
    llamado = true;
    return new Response("{}", { status: 200 });
  }) as unknown as typeof fetch;
  const r = await proponerCategorias(P, [], { proveedor: ANTHROPIC, fetchImpl });
  assert.equal(r.ok, false);
  assert.match(r.ok === false ? r.error : "", /categorías/i);
  assert.equal(llamado, false);
});

// ── Fallos ────────────────────────────────────────────────────────────────────

test("un 429 explica que hay que esperar", async () => {
  const fetchImpl = (async () => new Response("x", { status: 429 })) as unknown as typeof fetch;
  const r = await proponerNombres(P, [], { proveedor: ANTHROPIC, fetchImpl });
  assert.match(r.ok === false ? r.error : "", /minuto|saturado/i);
});

test("sin proveedor configurado lo dice, no rompe", async () => {
  const r = await proponerCategorias(P, CATS, { proveedor: null });
  assert.equal(r.ok, false);
});

test("una respuesta que no es JSON no se convierte en cambios", async () => {
  const { fetchImpl } = api("No puedo ayudarte con eso.");
  const r = await proponerNombres(P, [], { proveedor: ANTHROPIC, fetchImpl });
  assert.equal(r.ok, false);
});
