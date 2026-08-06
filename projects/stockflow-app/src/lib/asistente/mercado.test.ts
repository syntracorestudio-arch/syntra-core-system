/**
 * Tests del contexto de mercado (INDEC).
 *
 * Es la primera vez que entra al reporte un dato que NO calculamos nosotros, así
 * que las garantías son distintas a las del resto: no se puede verificar contra
 * la base, solo contra la fuente. De ahí las tres reglas que defienden estos
 * tests — si la fuente no responde no hay línea de mercado (nunca un invento),
 * el mes del dato se nombra siempre (INDEC publica con atraso y el dato más
 * nuevo es de un mes ANTERIOR al del reporte), y una sola llamada por corrida
 * aunque haya 500 negocios.
 *
 * Se corre con: node --test src/lib/asistente/mercado.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { contextoDeMercado, seriesDelRubro, __limpiarCache } from "./mercado.ts";

/** Lo que devuelve la API de series de datos.gob.ar, en su forma real. */
const respuesta = (filas: [string, ...number[]][]) =>
  new Response(JSON.stringify({ data: filas }), { status: 200 });

const FILAS: [string, ...number[]][] = [
  ["2026-05-01", 0.0246, 0.0079],
  ["2026-04-01", 0.015, 0.0187],
];

function apiQueResponde(res: () => Response) {
  const urls: string[] = [];
  const fetchImpl = (async (u: string | URL | Request) => {
    urls.push(String(u));
    return res();
  }) as unknown as typeof fetch;
  return { urls, fetchImpl };
}

test.beforeEach(() => __limpiarCache());

// ── Qué series se piden según el rubro ─────────────────────────────────────────

test("un kiosco mira alimentos y tabaco; no le importa educación", () => {
  const s = seriesDelRubro("kiosco");
  assert.deepEqual(s.map((x) => x.nombre), ["Alimentos y bebidas", "Bebidas alcohólicas y tabaco"]);
  assert.ok(s.every((x) => /^\d+\.\d+_/.test(x.id)));
});

test("un rubro que no conocemos cae en el índice de bienes, no en cualquier cosa", () => {
  assert.deepEqual(seriesDelRubro("otro").map((x) => x.nombre), ["Bienes"]);
  assert.deepEqual(seriesDelRubro("petshop").map((x) => x.nombre), ["Alimentos y bebidas", "Bienes"]);
});

// ── El dato ────────────────────────────────────────────────────────────────────

test("devuelve la variación del último mes publicado, en porcentaje", async () => {
  const { fetchImpl } = apiQueResponde(() => respuesta(FILAS));
  const m = await contextoDeMercado("kiosco", { fetchImpl });
  assert.equal(m?.fuente, "INDEC");
  assert.deepEqual(m?.divisiones, [
    { nombre: "Alimentos y bebidas", variacionPct: 2.5 },
    { nombre: "Bebidas alcohólicas y tabaco", variacionPct: 0.8 },
  ]);
});

test("el mes del dato se nombra: INDEC publica atrasado y no es el mes del reporte", async () => {
  const { fetchImpl } = apiQueResponde(() => respuesta(FILAS));
  const m = await contextoDeMercado("kiosco", { fetchImpl });
  assert.equal(m?.periodo, "mayo de 2026");
});

test("pide las series del rubro a la API de series", async () => {
  const { urls, fetchImpl } = apiQueResponde(() => respuesta(FILAS));
  await contextoDeMercado("kiosco", { fetchImpl });
  assert.match(urls[0], /apis\.datos\.gob\.ar/);
  assert.match(urls[0], /representation_mode=percent_change/);
  assert.match(urls[0], /146\.3_IALIMENNAL/);
});

// ── Si la fuente falla, no hay línea de mercado (jamás un invento) ─────────────

test("un error HTTP devuelve null, no una estimación", async () => {
  const fetchImpl = (async () => new Response("nope", { status: 503 })) as unknown as typeof fetch;
  assert.equal(await contextoDeMercado("kiosco", { fetchImpl }), null);
});

test("una caída de red devuelve null", async () => {
  const fetchImpl = (async () => {
    throw new Error("ETIMEDOUT");
  }) as unknown as typeof fetch;
  assert.equal(await contextoDeMercado("kiosco", { fetchImpl }), null);
});

test("una respuesta sin filas devuelve null", async () => {
  const { fetchImpl } = apiQueResponde(() => respuesta([]));
  assert.equal(await contextoDeMercado("kiosco", { fetchImpl }), null);
});

test("una fila con valores no numéricos devuelve null", async () => {
  const { fetchImpl } = apiQueResponde(() => new Response(JSON.stringify({ data: [["2026-05-01", null]] }), { status: 200 }));
  assert.equal(await contextoDeMercado("kiosco", { fetchImpl }), null);
});

// ── Una llamada por corrida, no una por negocio ────────────────────────────────

test("500 negocios del mismo rubro no son 500 llamadas a INDEC", async () => {
  const { urls, fetchImpl } = apiQueResponde(() => respuesta(FILAS));
  const a = await contextoDeMercado("kiosco", { fetchImpl });
  const b = await contextoDeMercado("kiosco", { fetchImpl });
  assert.equal(urls.length, 1);
  assert.deepEqual(a, b);
});

test("rubros distintos piden series distintas", async () => {
  const { urls, fetchImpl } = apiQueResponde(() => respuesta(FILAS));
  await contextoDeMercado("kiosco", { fetchImpl });
  await contextoDeMercado("otro", { fetchImpl });
  assert.equal(urls.length, 2);
});

test("un fallo no queda cacheado: el mes que viene se vuelve a intentar", async () => {
  let falla = true;
  const fetchImpl = (async () =>
    falla ? new Response("x", { status: 500 }) : respuesta(FILAS)) as unknown as typeof fetch;
  assert.equal(await contextoDeMercado("kiosco", { fetchImpl }), null);
  falla = false;
  assert.ok(await contextoDeMercado("kiosco", { fetchImpl }));
});
