/**
 * Tests de la llamada con visión. Lo que garantizan: la pantalla de ingreso
 * sigue funcionando a mano pase lo que pase con el modelo, y ninguna respuesta
 * rara se convierte en líneas de stock.
 *
 * Se corre con: node --test src/lib/asistente/leer-remito.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { leerRemito } from "./leer-remito.ts";

const IMG = { base64: "AAAA", mediaType: "image/jpeg" };
const ANTHROPIC = { nombre: "anthropic" as const, url: "https://api.anthropic.com/v1/messages", apiKey: "k", modelo: "claude-haiku-4-5" };
const GROQ = { nombre: "openai-compat" as const, url: "https://x/y", apiKey: "k", modelo: "m" };

const BUENO = JSON.stringify({
  lineas: [
    { texto: "Coca 2.25L", cantidad: "12", costo: "$1.450,50" },
    { texto: "Alfajor Jorgito", cantidad: "6", costo: "890" },
  ],
});

function api(texto: string, status = 200) {
  const llamadas: RequestInit[] = [];
  const fetchImpl = (async (_u: unknown, init?: RequestInit) => {
    llamadas.push(init ?? {});
    return new Response(
      JSON.stringify({ content: [{ type: "text", text: texto }], usage: { input_tokens: 1500, output_tokens: 90 } }),
      { status },
    );
  }) as unknown as typeof fetch;
  return { llamadas, fetchImpl };
}

test("transcribe los renglones y los devuelve normalizados", async () => {
  const { fetchImpl } = api(BUENO);
  const r = await leerRemito(IMG, { proveedor: ANTHROPIC, fetchImpl });
  assert.equal(r.ok, true);
  assert.equal(r.ok && r.lineas.length, 2);
  assert.equal(r.ok && r.lineas[0].cantidad, 12);
  assert.equal(r.ok && r.lineas[0].costoUnitario, 1450.5);
  assert.equal(r.ok && r.tokensIn, 1500);
});

test("la imagen viaja como bloque base64 en el dialecto de Anthropic", async () => {
  const { llamadas, fetchImpl } = api(BUENO);
  await leerRemito(IMG, { proveedor: ANTHROPIC, fetchImpl });
  const body = JSON.parse(String(llamadas[0].body));
  const img = body.messages[0].content[0];
  assert.equal(img.type, "image");
  assert.equal(img.source.media_type, "image/jpeg");
  assert.equal(img.source.data, "AAAA");
});

test("y como data URL en el dialecto compatible con OpenAI", async () => {
  const { llamadas, fetchImpl } = api(BUENO);
  await leerRemito(IMG, { proveedor: GROQ, fetchImpl });
  const body = JSON.parse(String(llamadas[0].body));
  assert.equal(body.messages[0].role, "system");
  assert.match(body.messages[1].content[0].image_url.url, /^data:image\/jpeg;base64,AAAA$/);
});

test("acepta el JSON envuelto en un bloque de código", async () => {
  const { fetchImpl } = api("```json\n" + BUENO + "\n```");
  const r = await leerRemito(IMG, { proveedor: ANTHROPIC, fetchImpl });
  assert.equal(r.ok, true);
});

// ── Todo lo que puede salir mal deja la pantalla usable ───────────────────────

test("sin proveedor configurado lo dice, no rompe", async () => {
  const r = await leerRemito(IMG, { proveedor: null });
  assert.equal(r.ok, false);
});

test("un remito ilegible NO devuelve líneas vacías: devuelve un error accionable", async () => {
  const { fetchImpl } = api(JSON.stringify({ lineas: [] }));
  const r = await leerRemito(IMG, { proveedor: ANTHROPIC, fetchImpl });
  assert.equal(r.ok, false);
  assert.match(r.ok === false ? r.error : "", /foto|renglones/i);
});

test("un 429 explica que hay que esperar, no 'algo salió mal'", async () => {
  const fetchImpl = (async () => new Response("x", { status: 429 })) as unknown as typeof fetch;
  const r = await leerRemito(IMG, { proveedor: ANTHROPIC, fetchImpl });
  assert.equal(r.ok, false);
  assert.match(r.ok === false ? r.error : "", /minuto|saturado/i);
});

test("una respuesta que no es JSON no se convierte en stock", async () => {
  const { fetchImpl } = api("Perdón, no puedo leer esa imagen.");
  const r = await leerRemito(IMG, { proveedor: ANTHROPIC, fetchImpl });
  assert.equal(r.ok, false);
});

test("una caída de red devuelve un error legible", async () => {
  const fetchImpl = (async () => {
    throw new Error("ETIMEDOUT");
  }) as unknown as typeof fetch;
  const r = await leerRemito(IMG, { proveedor: ANTHROPIC, fetchImpl });
  assert.equal(r.ok, false);
  assert.match(r.ok === false ? r.error : "", /mano|de nuevo/i);
});
