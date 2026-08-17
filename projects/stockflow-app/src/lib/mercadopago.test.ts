import test from "node:test";
import assert from "node:assert/strict";
import { mpReembolsarOrden } from "./mercadopago.ts";

/**
 * El cliente HTTP del REEMBOLSO — el código que devuelve plata real.
 *
 * Hasta acá no tenía un solo test: `mercadopago.ts` importa con `@/…`, así que
 * el runner no podía cargarlo (lo resuelve `scripts/alias-loader.mjs`, sin
 * dependencias nuevas). Correr con:
 *
 *   node --import ./scripts/alias-loader.mjs --test src/lib/mercadopago.test.ts
 *
 * Qué prueba y qué NO. Esto verifica NUESTRA mitad: qué mandamos y cómo leemos
 * lo que vuelve. No valida el contrato de MercadoPago — para eso hace falta el
 * sandbox (docs/mercadopago-sandbox-checklist.md). Un stub no puede contestar
 * si el endpoint es el correcto: le estaríamos preguntando a nuestra propia
 * suposición si nuestra suposición es correcta.
 *
 * Lo que sí está contrastado contra la doc oficial de MP:
 *   · `POST /v1/orders/{id}/refund`
 *   · header `X-Idempotency-Key`
 *   · reembolso TOTAL ⇒ "the request body must be empty"
 *   · éxito = 201
 */

type Captura = { url: string; init: RequestInit };

/** Reemplaza `fetch` por un doble que captura la request y devuelve lo pedido. */
function conFetchFalso(
  responder: () => { status: number; body: unknown },
  fn: () => Promise<unknown>,
): Promise<{ resultado: unknown; capturas: Captura[] }> {
  const capturas: Captura[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL | Request, init: RequestInit = {}) => {
    capturas.push({ url: String(url), init });
    const { status, body } = responder();
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  return fn()
    .then((resultado) => ({ resultado, capturas }))
    .finally(() => {
      globalThis.fetch = original;
    });
}

test("reembolso total: NO manda cuerpo (la doc de MP lo exige vacío)", async () => {
  const { capturas } = await conFetchFalso(
    () => ({ status: 201, body: { id: "ord-1", status: "refunded" } }),
    () => mpReembolsarOrden("token-x", "ord-1", "refund-abc"),
  );

  assert.equal(capturas.length, 1);
  /* LA REGRESIÓN QUE ESTE TEST EXISTE PARA IMPEDIR: acá decía `body: {}`, y `{}`
     es truthy en JS, así que se serializaba y viajaba el string "{}". Si MP lo
     valida, devuelve 400 y NO reembolsa: el cliente esperando en el mostrador y
     la pata sigue `approved`. */
  assert.equal(
    capturas[0].init.body,
    undefined,
    'el reembolso total no debe llevar cuerpo (ni siquiera "{}")',
  );
});

test("manda el idempotency key con el nombre EXACTO que pide MP", async () => {
  const { capturas } = await conFetchFalso(
    () => ({ status: 201, body: {} }),
    () => mpReembolsarOrden("token-x", "ord-1", "refund-pata-9"),
  );

  const headers = capturas[0].init.headers as Record<string, string>;
  // `X-Idempotency-Key`, no `Idempotency-Key`: con el nombre mal, un reintento
  // devuelve DOS VECES.
  assert.equal(headers["X-Idempotency-Key"], "refund-pata-9");
  assert.equal(headers.Authorization, "Bearer token-x");
});

test("pega en POST /v1/orders/{id}/refund", async () => {
  const { capturas } = await conFetchFalso(
    () => ({ status: 201, body: {} }),
    () => mpReembolsarOrden("t", "ord-42", "k"),
  );

  assert.equal(capturas[0].init.method, "POST");
  assert.ok(
    capturas[0].url.endsWith("/v1/orders/ord-42/refund"),
    `URL inesperada: ${capturas[0].url}`,
  );
});

test("201 es éxito (MP no devuelve 200 acá)", async () => {
  const { resultado } = await conFetchFalso(
    () => ({ status: 201, body: { status: "refunded" } }),
    () => mpReembolsarOrden("t", "o", "k"),
  );
  assert.deepEqual(resultado, { ok: true });
});

test("409 se traduce a algo que el dueño entiende, no al texto de MP", async () => {
  const { resultado } = await conFetchFalso(
    () => ({ status: 409, body: { message: "refund already exists for this order" } }),
    () => mpReembolsarOrden("t", "o", "k"),
  );
  const r = resultado as { ok: false; error: string };
  assert.equal(r.ok, false);
  assert.match(r.error, /ya fue devuelta/i);
});

test("422 explica que hay que devolverlo desde la cuenta de MP", async () => {
  const { resultado } = await conFetchFalso(
    () => ({ status: 422, body: { message: "payment not refundable" } }),
    () => mpReembolsarOrden("t", "o", "k"),
  );
  const r = resultado as { ok: false; error: string };
  assert.match(r.error, /desde tu cuenta/i);
});

test("425/428 dicen que espere: el pago todavía se acredita", async () => {
  for (const status of [425, 428]) {
    const { resultado } = await conFetchFalso(
      () => ({ status, body: {} }),
      () => mpReembolsarOrden("t", "o", "k"),
    );
    const r = resultado as { ok: false; error: string };
    assert.match(r.error, /acreditando/i, `status ${status}`);
  }
});

test("un error no mapeado sigue pasando el detalle de MP", async () => {
  const { resultado } = await conFetchFalso(
    () => ({ status: 400, body: { message: "invalid order id" } }),
    () => mpReembolsarOrden("t", "o", "k"),
  );
  const r = resultado as { ok: false; error: string };
  // No se inventa un mensaje propio para lo que no sabemos explicar.
  assert.match(r.error, /invalid order id/);
});
