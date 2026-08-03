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

test("una respuesta con forma rara tampoco", async () => {
  const fetchImpl = (async () => new Response(JSON.stringify({ content: [] }), { status: 200 })) as unknown as typeof fetch;
  const res = await narrarMes(REPORTE, { apiKey: "sk-test", fetchImpl });
  assert.equal(res.estado, "fallida");
});
