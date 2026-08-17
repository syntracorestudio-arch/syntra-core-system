import test from "node:test";
import assert from "node:assert/strict";
import { rutaInternaSegura } from "./redirect-seguro.ts";

/**
 * El guard del `next` de `/auth/callback`.
 *
 * Importa más que un redirect cualquiera: ese handler corre DESPUÉS de canjear
 * el token por sesión, y el link llega por mail — o sea, el peor combo posible
 * si el destino no está recortado.
 */

test("deja pasar rutas internas", () => {
  assert.equal(rutaInternaSegura("/cuenta"), "/cuenta");
  assert.equal(rutaInternaSegura("/cuenta?nueva=1"), "/cuenta?nueva=1");
  assert.equal(rutaInternaSegura("/admin/caja"), "/admin/caja");
});

test("rechaza URLs absolutas", () => {
  assert.equal(rutaInternaSegura("https://sitio-falso.com"), null);
  assert.equal(rutaInternaSegura("http://sitio-falso.com"), null);
  // Sin esquema explícito pero igual externo.
  assert.equal(rutaInternaSegura("sitio-falso.com"), null);
});

test("rechaza el protocolo-relativo, que es la trampa que parece interna", () => {
  /* Arranca con "/" y pasaría un chequeo ingenuo, pero el navegador lo resuelve
     como host EXTERNO. */
  assert.equal(rutaInternaSegura("//sitio-falso.com"), null);
  assert.equal(rutaInternaSegura("//sitio-falso.com/robar"), null);
});

test("rechaza la variante con backslash que algunos navegadores normalizan a //", () => {
  assert.equal(rutaInternaSegura("/\\sitio-falso.com"), null);
});

test("rechaza saltos de línea y caracteres de control (inyección de cabeceras)", () => {
  assert.equal(rutaInternaSegura("/cuenta\nLocation: https://sitio-falso.com"), null);
  assert.equal(rutaInternaSegura("/cuenta\r\nSet-Cookie: x=1"), null);
});

test("vacío o ausente no es un destino", () => {
  assert.equal(rutaInternaSegura(null), null);
  assert.equal(rutaInternaSegura(undefined), null);
  assert.equal(rutaInternaSegura(""), null);
});
