/**
 * Tests de la elección de proveedor del LLM.
 *
 * Por qué existe esta capa: la narrativa se prueba con un proveedor gratuito
 * antes de decidir si se paga uno. El verificador de cifras y el fallback no
 * cambian — lo único que cambia es a qué endpoint se le pide el párrafo.
 *
 * Se corre con: node --test src/lib/asistente/proveedor.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { resolverProveedor } from "./proveedor.ts";

test("sin ninguna key, el asistente no llama a nadie", () => {
  assert.equal(resolverProveedor({}), null);
});

test("con LLM_API_KEY sola alcanza: el resto son defaults de Groq", () => {
  const p = resolverProveedor({ LLM_API_KEY: "gsk_test" });
  assert.equal(p?.nombre, "openai-compat");
  assert.equal(p?.apiKey, "gsk_test");
  assert.ok(p?.url.startsWith("https://api.groq.com/"), p?.url);
  assert.ok((p?.modelo ?? "").length > 0);
});

test("el endpoint y el modelo se pueden cambiar sin tocar código", () => {
  const p = resolverProveedor({
    LLM_API_KEY: "k",
    LLM_BASE_URL: "https://api.otro.dev/v1/chat/completions",
    LLM_MODEL: "modelo-x",
  });
  assert.equal(p?.url, "https://api.otro.dev/v1/chat/completions");
  assert.equal(p?.modelo, "modelo-x");
});

test("sin LLM_API_KEY cae a Anthropic, que es el destino final", () => {
  const p = resolverProveedor({ ANTHROPIC_API_KEY: "sk-ant-x" });
  assert.equal(p?.nombre, "anthropic");
  assert.equal(p?.url, "https://api.anthropic.com/v1/messages");
  assert.equal(p?.modelo, "claude-haiku-4-5");
});

test("si están las dos, manda la gratuita: es la que se está probando", () => {
  const p = resolverProveedor({ LLM_API_KEY: "gsk", ANTHROPIC_API_KEY: "sk-ant" });
  assert.equal(p?.nombre, "openai-compat");
});

test("una key en blanco no cuenta como key", () => {
  assert.equal(resolverProveedor({ LLM_API_KEY: "   " }), null);
  assert.equal(resolverProveedor({ ANTHROPIC_API_KEY: "" }), null);
});

test("una clave de Anthropic en LLM_API_KEY no se manda a Groq", () => {
  // Foot-gun real: la instrucción de configuración decía LLM_API_KEY=sk-ant-...
  // y el código la mandaba a la URL de Groq. Volvía 401 y el reporte salía sin
  // análisis, con un motivo imposible de adivinar desde afuera.
  const p = resolverProveedor({ LLM_API_KEY: "sk-ant-abc", LLM_MODEL: "claude-haiku-4-5" });
  assert.equal(p?.nombre, "anthropic");
  assert.match(p?.url ?? "", /api\.anthropic\.com/);
  assert.equal(p?.modelo, "claude-haiku-4-5");
});

test("LLM_PROVIDER manda por encima del prefijo de la clave", () => {
  const p = resolverProveedor({ LLM_PROVIDER: "anthropic", LLM_API_KEY: "otra-cosa" });
  assert.equal(p?.nombre, "anthropic");
  const q = resolverProveedor({ LLM_PROVIDER: "groq", LLM_API_KEY: "gsk_x" });
  assert.equal(q?.nombre, "openai-compat");
});
