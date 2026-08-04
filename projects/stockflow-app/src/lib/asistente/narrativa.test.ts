/**
 * Tests de la capa LLM. Lo que garantizan: el reporte SALE IGUAL pase lo que pase
 * con el modelo. La narrativa es un extra que se cae solo si algo falla —
 * nunca un motivo para no mandarle el mes al dueño.
 *
 * Se corre con: node --test src/lib/asistente/narrativa.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { narrarMes } from "./narrativa.ts";
import type { ReporteMensual } from "./composer.ts";

const REPORTE: ReporteMensual = {
  negocio: { nombre: "Kiosco Escala", rubro: "Kiosco", periodoLabel: "Julio de 2026", desde: "2026-07-01" },
  resumen: {
    facturado: 12480300,
    gananciaBruta: 3744090,
    gastos: 0,
    gananciaNeta: null,
    tieneGastos: false,
    coberturaCostoPct: 100,
    tickets: 842,
    vsMesAnteriorPct: -12,
    facturadoPrev: 14182160,
    mesAnteriorLabel: "junio",
  },
  oportunidades: [
    {
      tipo: "fiado",
      titulo: "Fiado atrasado para salir a cobrar",
      detalle: "3 clientes con deuda vieja. El más atrasado: Roberto Díaz, hace 61 días.",
      monto: 43700,
      cantidad: 3,
      sujeto: "Roberto Díaz",
      ruta: "/admin/fiado",
      cta: "Ver los 3 clientes",
    },
  ],
  detalle: { topGanancia: [], medios: [], gastosPorCategoria: [] },
  alertas: { porVencer: [], stockBajo: [] },
};

/** Stub de la API: devuelve el texto pedido y registra con qué se la llamó. */
function apiQueResponde(texto: string) {
  const llamadas: { url: string; init: RequestInit }[] = [];
  const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
    llamadas.push({ url: String(url), init: init ?? {} });
    return new Response(
      JSON.stringify({
        content: [{ type: "text", text: texto }],
        usage: { input_tokens: 1200, output_tokens: 180 },
      }),
      { status: 200 },
    );
  };
  return { llamadas, fetchImpl: fetchImpl as unknown as typeof fetch };
}

const BUENA = "Facturaste $12.480.300, un 12% menos que junio. Lo que más pesa hoy es el fiado viejo.";

// ── Camino feliz ───────────────────────────────────────────────────────────────

test("con API key y una respuesta válida, devuelve el párrafo", async () => {
  const { fetchImpl } = apiQueResponde(`  ${BUENA}  `);
  const res = await narrarMes(REPORTE, { apiKey: "sk-test", fetchImpl });
  assert.equal(res.estado, "ok");
  assert.equal(res.texto, BUENA); // llega sin los espacios de más
  assert.equal(res.tokensIn, 1200);
  assert.equal(res.tokensOut, 180);
});

test("el prompt no lleva el nombre del deudor ni el del negocio", async () => {
  const { llamadas, fetchImpl } = apiQueResponde(BUENA);
  await narrarMes(REPORTE, { apiKey: "sk-test", fetchImpl });
  const body = String(llamadas[0].init.body);
  assert.ok(!body.includes("Roberto"), body);
  assert.ok(!body.includes("Kiosco Escala"), body);
  assert.ok(body.includes("12480300"), "los números sí tienen que viajar");
});

test("se llama a la API de mensajes con la autenticación esperada", async () => {
  const { llamadas, fetchImpl } = apiQueResponde(BUENA);
  await narrarMes(REPORTE, { apiKey: "sk-test", modelo: "claude-haiku-4-5-20251001", fetchImpl });
  const { url, init } = llamadas[0];
  assert.equal(url, "https://api.anthropic.com/v1/messages");
  const headers = init.headers as Record<string, string>;
  assert.equal(headers["x-api-key"], "sk-test");
  assert.equal(headers["anthropic-version"], "2023-06-01");
  assert.equal(JSON.parse(String(init.body)).model, "claude-haiku-4-5-20251001");
});

// ── Todo lo que puede salir mal termina igual: sin narrativa, con reporte ───────

test("sin API key no se llama a nadie: la narrativa queda desactivada", async () => {
  let llamado = false;
  const fetchImpl = (async () => {
    llamado = true;
    return new Response("{}", { status: 200 });
  }) as unknown as typeof fetch;

  const res = await narrarMes(REPORTE, { apiKey: null, fetchImpl });
  assert.equal(res.estado, "desactivada");
  assert.equal(res.texto, null);
  assert.equal(llamado, false);
});

test("si el modelo inventa una cifra, el párrafo se descarta entero", async () => {
  const { fetchImpl } = apiQueResponde("Tenés $9.900.000 parados en el estante hace meses.");
  const res = await narrarMes(REPORTE, { apiKey: "sk-test", fetchImpl });
  assert.equal(res.estado, "rechazada");
  assert.equal(res.texto, null);
  assert.match(res.motivo ?? "", /9900000/);
});

test("un error HTTP no rompe el reporte", async () => {
  const fetchImpl = (async () => new Response("rate limited", { status: 429 })) as unknown as typeof fetch;
  const res = await narrarMes(REPORTE, { apiKey: "sk-test", fetchImpl });
  assert.equal(res.estado, "fallida");
  assert.equal(res.texto, null);
  assert.match(res.motivo ?? "", /429/);
});

test("una caída de red tampoco", async () => {
  const fetchImpl = (async () => {
    throw new Error("ETIMEDOUT");
  }) as unknown as typeof fetch;
  const res = await narrarMes(REPORTE, { apiKey: "sk-test", fetchImpl });
  assert.equal(res.estado, "fallida");
  assert.match(res.motivo ?? "", /ETIMEDOUT/);
});

// ── Proveedor gratuito (OpenAI-compatible: Groq y cualquier otro igual) ────────

test("con un proveedor OpenAI-compatible habla su dialecto, no el de Anthropic", async () => {
  const llamadas: { url: string; init: RequestInit }[] = [];
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    llamadas.push({ url: String(url), init: init ?? {} });
    return new Response(
      JSON.stringify({
        choices: [{ message: { content: BUENA } }],
        usage: { prompt_tokens: 800, completion_tokens: 90 },
      }),
      { status: 200 },
    );
  }) as unknown as typeof fetch;

  const res = await narrarMes(REPORTE, {
    proveedor: {
      nombre: "openai-compat",
      url: "https://api.groq.com/openai/v1/chat/completions",
      apiKey: "gsk_test",
      modelo: "llama-3.3-70b-versatile",
    },
    fetchImpl,
  });

  assert.equal(res.estado, "ok");
  assert.equal(res.texto, BUENA);
  assert.equal(res.tokensIn, 800);
  assert.equal(res.tokensOut, 90);

  const { url, init } = llamadas[0];
  assert.equal(url, "https://api.groq.com/openai/v1/chat/completions");
  const headers = init.headers as Record<string, string>;
  assert.equal(headers.authorization, "Bearer gsk_test");
  assert.equal(headers["x-api-key"], undefined, "no manda la cabecera de Anthropic");

  // El sistema viaja como un mensaje con rol 'system', no como campo aparte.
  const body = JSON.parse(String(init.body));
  assert.equal(body.model, "llama-3.3-70b-versatile");
  assert.equal(body.messages[0].role, "system");
  assert.equal(body.messages[1].role, "user");
  assert.ok(!body.system, "el campo `system` es de Anthropic, acá no va");
  assert.ok(!String(init.body).includes("Roberto"), "el deudor tampoco viaja acá");
});

test("el pedido normal NO lleva reasoning_effort: los modelos comunes lo rechazan", async () => {
  // Verificado contra Groq: llama-3.3-70b y qwen3.6 devuelven 400 con ese campo.
  const llamadas: RequestInit[] = [];
  const fetchImpl = (async (_u: unknown, init?: RequestInit) => {
    llamadas.push(init ?? {});
    return new Response(JSON.stringify({ choices: [{ message: { content: BUENA } }] }), { status: 200 });
  }) as unknown as typeof fetch;

  await narrarMes(REPORTE, {
    proveedor: { nombre: "openai-compat", url: "https://x/y", apiKey: "k", modelo: "llama-3.3-70b-versatile" },
    fetchImpl,
  });
  assert.equal(llamadas.length, 1, "un solo intento cuando el modelo contesta");
  assert.equal(JSON.parse(String(llamadas[0].body)).reasoning_effort, undefined);
});

test("al que se queda pensando se le pide UNA vez más con razonamiento mínimo", async () => {
  /* gpt-oss y compañía gastan el presupuesto de tokens PENSANDO y devuelven
     `content` vacío. Verificado contra Groq: con esto el mismo modelo contesta. */
  const llamadas: RequestInit[] = [];
  const fetchImpl = (async (_u: unknown, init?: RequestInit) => {
    llamadas.push(init ?? {});
    const primero = llamadas.length === 1;
    return new Response(
      JSON.stringify({
        choices: [primero ? { finish_reason: "length", message: { content: "" } } : { message: { content: BUENA } }],
      }),
      { status: 200 },
    );
  }) as unknown as typeof fetch;

  const res = await narrarMes(REPORTE, {
    proveedor: { nombre: "openai-compat", url: "https://x/y", apiKey: "k", modelo: "openai/gpt-oss-120b" },
    fetchImpl,
  });
  assert.equal(llamadas.length, 2);
  assert.equal(JSON.parse(String(llamadas[1].body)).reasoning_effort, "low");
  assert.equal(res.estado, "ok");
  assert.equal(res.texto, BUENA);
});

test("si el modelo se quedó sin tokens, el motivo lo dice", async () => {
  const fetchImpl = (async () =>
    new Response(JSON.stringify({ choices: [{ finish_reason: "length", message: { content: "" } }] }), {
      status: 200,
    })) as unknown as typeof fetch;

  const res = await narrarMes(REPORTE, {
    proveedor: { nombre: "openai-compat", url: "https://x/y", apiKey: "k", modelo: "m" },
    fetchImpl,
  });
  assert.equal(res.estado, "fallida");
  assert.equal(res.motivo, "sin_texto_por_limite"); // no un "sin_texto" mudo
});

test("el verificador NO se afloja con el proveedor gratuito", async () => {
  const fetchImpl = (async () =>
    new Response(
      JSON.stringify({ choices: [{ message: { content: "Tenés $9.900.000 parados en el estante." } }] }),
      { status: 200 },
    )) as unknown as typeof fetch;

  const res = await narrarMes(REPORTE, {
    proveedor: { nombre: "openai-compat", url: "https://x/y", apiKey: "k", modelo: "m" },
    fetchImpl,
  });
  assert.equal(res.estado, "rechazada");
  assert.equal(res.texto, null);
});

test("los modelos que 'piensan' en voz alta no arruinan el párrafo", async () => {
  // Varios modelos abiertos abren con un bloque <think>. Sin esto, el
  // verificador lo lee como markup y descarta un párrafo perfectamente válido.
  const fetchImpl = (async () =>
    new Response(
      JSON.stringify({
        choices: [{ message: { content: `<think>El mes bajó, arranco por ahí.</think>\n\n${BUENA}` } }],
      }),
      { status: 200 },
    )) as unknown as typeof fetch;

  const res = await narrarMes(REPORTE, {
    proveedor: { nombre: "openai-compat", url: "https://x/y", apiKey: "k", modelo: "m" },
    fetchImpl,
  });
  assert.equal(res.estado, "ok");
  assert.equal(res.texto, BUENA);
});

test("una respuesta con forma rara tampoco", async () => {
  const fetchImpl = (async () => new Response(JSON.stringify({ content: [] }), { status: 200 })) as unknown as typeof fetch;
  const res = await narrarMes(REPORTE, { apiKey: "sk-test", fetchImpl });
  assert.equal(res.estado, "fallida");
});
