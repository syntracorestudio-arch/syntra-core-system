/**
 * Tests de la capa LLM. Lo que garantizan: el reporte SALE IGUAL pase lo que pase
 * con el modelo. El análisis es un extra que se cae solo si algo falla — nunca un
 * motivo para no mandarle el mes al dueño.
 *
 * Se corre con: node --test src/lib/asistente/narrativa.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { narrarMes } from "./narrativa.ts";
import type { Crudos } from "./hechos.ts";
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

/** Los crudos que hacen que el análisis pueda decir algo más que el email. */
const CRUDOS = {
  datos: {
    resumen: {
      credit: { given: 0, collected: 0, overdue: [{ name: "Roberto Díaz", owed: 43700, dias: 61 }] },
      dead_stock: { total: 0, items: [] },
      data_health: { cost_coverage: 91, products_without_cost: 250, stale_prices: 2000 },
      by_category: [{ name: "Cigarrillos", revenue: 1775150, profit: 621302 }],
      by_slot: [{ name: "Mañana", total: 3501840, tickets: 404 }],
      waste: { total: 0 },
    },
  },
  margenes: {
    total_por_mes: 57910,
    min_margen: 35,
    productos: [
      {
        name: "Chesterfield 100g 8",
        emoji: null,
        precio: 4950,
        precio_sugerido: 5850,
        margen_hoy: 12,
        plata_por_mes: 17100,
        unidades_30d: 19,
      },
    ],
  },
} as unknown as Crudos;

/** Un análisis que pasa la verificación contra los datos de arriba. */
const BUENO = JSON.stringify({
  dolor: {
    titulo: "Vendés mucho de lo que menos te deja",
    porque: "Los cigarrillos son tu categoría más grande y los vendés al 12% de margen.",
  },
  acciones: [
    {
      tipo: "remarcar",
      texto: "Subí Chesterfield 100g 8 de $4.950 a $5.850.",
      producto: "Chesterfield 100g 8",
      monto: 17100,
    },
    { tipo: "fiado", texto: "Salí a cobrar: son 3 clientes.", producto: null, monto: 43700 },
  ],
  fuga: null,
  huecos: "Tenés 250 productos sin costo cargado.",
});

const respuestaOpenAI = (contenido: string, extra: Record<string, unknown> = {}) =>
  new Response(
    JSON.stringify({
      choices: [{ message: { content: contenido }, ...extra }],
      usage: { prompt_tokens: 800, completion_tokens: 90 },
    }),
    { status: 200 },
  );

const GROQ = { nombre: "openai-compat" as const, url: "https://x/y", apiKey: "k", modelo: "m" };

function apiQueResponde(contenido: string) {
  const llamadas: { url: string; init: RequestInit }[] = [];
  const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
    llamadas.push({ url: String(url), init: init ?? {} });
    return new Response(
      JSON.stringify({
        content: [{ type: "text", text: contenido }],
        usage: { input_tokens: 1200, output_tokens: 180 },
      }),
      { status: 200 },
    );
  };
  return { llamadas, fetchImpl: fetchImpl as unknown as typeof fetch };
}

// ── Camino feliz ───────────────────────────────────────────────────────────────

test("con un análisis verificable devuelve los campos, no un párrafo", async () => {
  const { fetchImpl } = apiQueResponde(BUENO);
  const res = await narrarMes(REPORTE, { apiKey: "sk-test", fetchImpl, crudos: CRUDOS });
  assert.equal(res.estado, "ok", res.motivo ?? "");
  assert.equal(res.analisis?.dolor.titulo, "Vendés mucho de lo que menos te deja");
  assert.equal(res.analisis?.acciones.length, 2);
  assert.equal(res.analisis?.acciones[0].producto, "Chesterfield 100g 8");
  assert.equal(res.tokensIn, 1200);
});

test("acepta el JSON aunque venga envuelto en un bloque de código", async () => {
  const { fetchImpl } = apiQueResponde("```json\n" + BUENO + "\n```");
  const res = await narrarMes(REPORTE, { apiKey: "sk-test", fetchImpl, crudos: CRUDOS });
  assert.equal(res.estado, "ok", res.motivo ?? "");
});

test("el payload lleva el precio sugerido: sin eso el análisis no existe", async () => {
  const { llamadas, fetchImpl } = apiQueResponde(BUENO);
  await narrarMes(REPORTE, { apiKey: "sk-test", fetchImpl, crudos: CRUDOS });
  const body = String(llamadas[0].init.body);
  assert.ok(body.includes("5850"), "el precio sugerido tiene que viajar");
  assert.ok(body.includes("250"), "los productos sin costo también");
  assert.ok(!body.includes("Roberto"), "pero el deudor no");
  assert.ok(!body.includes("Kiosco Escala"), "ni el nombre del negocio");
});

test("se llama a la API de mensajes con la autenticación esperada", async () => {
  const { llamadas, fetchImpl } = apiQueResponde(BUENO);
  await narrarMes(REPORTE, { apiKey: "sk-test", modelo: "claude-haiku-4-5", fetchImpl, crudos: CRUDOS });
  const { url, init } = llamadas[0];
  assert.equal(url, "https://api.anthropic.com/v1/messages");
  const headers = init.headers as Record<string, string>;
  assert.equal(headers["x-api-key"], "sk-test");
  assert.equal(headers["anthropic-version"], "2023-06-01");
});

// ── Todo lo que puede salir mal termina igual: sin análisis, con reporte ────────

test("sin API key no se llama a nadie", async () => {
  let llamado = false;
  const fetchImpl = (async () => {
    llamado = true;
    return new Response("{}", { status: 200 });
  }) as unknown as typeof fetch;
  const res = await narrarMes(REPORTE, { apiKey: null, fetchImpl });
  assert.equal(res.estado, "desactivada");
  assert.equal(res.analisis, null);
  assert.equal(llamado, false);
});

test("si el modelo inventa una cifra, se descarta el análisis entero", async () => {
  const malo = JSON.parse(BUENO);
  malo.dolor.porque = "Estás perdiendo $9.900.000 por mes.";
  const { fetchImpl } = apiQueResponde(JSON.stringify(malo));
  const res = await narrarMes(REPORTE, { apiKey: "sk-test", fetchImpl, crudos: CRUDOS });
  assert.equal(res.estado, "rechazada");
  assert.equal(res.analisis, null);
});

test("si el modelo inventa un producto, esa acción se cae y el resto queda", async () => {
  const malo = JSON.parse(BUENO);
  malo.acciones[0].producto = "Marlboro Box";
  const { fetchImpl } = apiQueResponde(JSON.stringify(malo));
  const res = await narrarMes(REPORTE, { apiKey: "sk-test", fetchImpl, crudos: CRUDOS });
  assert.equal(res.estado, "ok", res.motivo ?? "");
  assert.deepEqual(res.analisis?.acciones.map((a) => a.tipo), ["fiado"]);
});

test("un texto que no es JSON no rompe nada", async () => {
  const { fetchImpl } = apiQueResponde("Este mes te fue bien, seguí así.");
  const res = await narrarMes(REPORTE, { apiKey: "sk-test", fetchImpl, crudos: CRUDOS });
  assert.equal(res.estado, "fallida");
  assert.equal(res.motivo, "json_invalido");
});

test("un error HTTP no rompe el reporte", async () => {
  const fetchImpl = (async () => new Response("rate limited", { status: 429 })) as unknown as typeof fetch;
  const res = await narrarMes(REPORTE, { apiKey: "sk-test", fetchImpl, crudos: CRUDOS });
  assert.equal(res.estado, "fallida");
  assert.match(res.motivo ?? "", /429/);
});

test("una caída de red tampoco", async () => {
  const fetchImpl = (async () => {
    throw new Error("ETIMEDOUT");
  }) as unknown as typeof fetch;
  const res = await narrarMes(REPORTE, { apiKey: "sk-test", fetchImpl, crudos: CRUDOS });
  assert.equal(res.estado, "fallida");
  assert.match(res.motivo ?? "", /ETIMEDOUT/);
});

// ── Proveedor gratuito (OpenAI-compatible) ─────────────────────────────────────

test("con un proveedor OpenAI-compatible habla su dialecto", async () => {
  const llamadas: RequestInit[] = [];
  const fetchImpl = (async (_u: unknown, init?: RequestInit) => {
    llamadas.push(init ?? {});
    return respuestaOpenAI(BUENO);
  }) as unknown as typeof fetch;

  const res = await narrarMes(REPORTE, { proveedor: GROQ, fetchImpl, crudos: CRUDOS });
  assert.equal(res.estado, "ok", res.motivo ?? "");
  assert.equal(res.tokensIn, 800);

  const headers = llamadas[0].headers as Record<string, string>;
  assert.equal(headers.authorization, "Bearer k");
  assert.equal(headers["x-api-key"], undefined);
  const body = JSON.parse(String(llamadas[0].body));
  assert.equal(body.messages[0].role, "system");
  assert.ok(!body.system);
});

test("el verificador NO se afloja con el proveedor gratuito", async () => {
  const malo = JSON.parse(BUENO);
  malo.acciones[1].monto = 9900000;
  const fetchImpl = (async () => respuestaOpenAI(JSON.stringify(malo))) as unknown as typeof fetch;
  const res = await narrarMes(REPORTE, { proveedor: GROQ, fetchImpl, crudos: CRUDOS });
  // La acción del monto inventado se cae; la buena sobrevive.
  assert.deepEqual(res.analisis?.acciones.map((a) => a.tipo), ["remarcar"]);
});

test("los modelos que 'piensan' en voz alta no arruinan el análisis", async () => {
  const fetchImpl = (async () =>
    respuestaOpenAI(`<think>Veamos los números.</think>\n${BUENO}`)) as unknown as typeof fetch;
  const res = await narrarMes(REPORTE, { proveedor: GROQ, fetchImpl, crudos: CRUDOS });
  assert.equal(res.estado, "ok", res.motivo ?? "");
});

test("el pedido normal NO lleva reasoning_effort: los modelos comunes lo rechazan", async () => {
  const llamadas: RequestInit[] = [];
  const fetchImpl = (async (_u: unknown, init?: RequestInit) => {
    llamadas.push(init ?? {});
    return respuestaOpenAI(BUENO);
  }) as unknown as typeof fetch;
  await narrarMes(REPORTE, { proveedor: GROQ, fetchImpl, crudos: CRUDOS });
  assert.equal(llamadas.length, 1);
  assert.equal(JSON.parse(String(llamadas[0].body)).reasoning_effort, undefined);
});

test("al que se queda pensando se le pide UNA vez más con razonamiento mínimo", async () => {
  const llamadas: RequestInit[] = [];
  const fetchImpl = (async (_u: unknown, init?: RequestInit) => {
    llamadas.push(init ?? {});
    return llamadas.length === 1
      ? respuestaOpenAI("", { finish_reason: "length" })
      : respuestaOpenAI(BUENO);
  }) as unknown as typeof fetch;

  const res = await narrarMes(REPORTE, { proveedor: GROQ, fetchImpl, crudos: CRUDOS });
  assert.equal(llamadas.length, 2);
  assert.equal(JSON.parse(String(llamadas[1].body)).reasoning_effort, "low");
  assert.equal(res.estado, "ok", res.motivo ?? "");
});

test("si se quedó sin tokens y no hay reintento útil, el motivo lo dice", async () => {
  const fetchImpl = (async () => respuestaOpenAI("", { finish_reason: "length" })) as unknown as typeof fetch;
  const res = await narrarMes(REPORTE, { proveedor: GROQ, fetchImpl, crudos: CRUDOS });
  assert.equal(res.estado, "fallida");
  assert.equal(res.motivo, "sin_texto_por_limite");
});

test("un JSON cortado a la mitad también dispara el reintento", async () => {
  // El modelo razonó de más y no le alcanzó para cerrar las llaves.
  const llamadas: RequestInit[] = [];
  const fetchImpl = (async (_u: unknown, init?: RequestInit) => {
    llamadas.push(init ?? {});
    return llamadas.length === 1
      ? respuestaOpenAI('{"dolor":{"titulo":"Algo","por', { finish_reason: "length" })
      : respuestaOpenAI(BUENO);
  }) as unknown as typeof fetch;

  const res = await narrarMes(REPORTE, { proveedor: GROQ, fetchImpl, crudos: CRUDOS });
  assert.equal(llamadas.length, 2);
  assert.equal(res.estado, "ok", res.motivo ?? "");
});

test("un rechazo de verificación se reintenta UNA vez, no infinitas", async () => {
  const malo = JSON.parse(BUENO);
  malo.dolor.porque = "Estás perdiendo $9.900.000 por mes.";
  let n = 0;
  const fetchImpl = (async () => {
    n++;
    return respuestaOpenAI(n === 1 ? JSON.stringify(malo) : BUENO);
  }) as unknown as typeof fetch;

  const res = await narrarMes(REPORTE, { proveedor: GROQ, fetchImpl, crudos: CRUDOS });
  assert.equal(n, 2, "reintenta una vez");
  assert.equal(res.estado, "ok", res.motivo ?? "");
});

test("si el reintento también falla, se rinde y el email sale sin análisis", async () => {
  const malo = JSON.parse(BUENO);
  malo.dolor.porque = "Estás perdiendo $9.900.000 por mes.";
  let n = 0;
  const fetchImpl = (async () => {
    n++;
    return respuestaOpenAI(JSON.stringify(malo));
  }) as unknown as typeof fetch;

  const res = await narrarMes(REPORTE, { proveedor: GROQ, fetchImpl, crudos: CRUDOS });
  assert.equal(n, 2, "no reintenta para siempre");
  assert.equal(res.estado, "rechazada");
  assert.equal(res.analisis, null);
});
