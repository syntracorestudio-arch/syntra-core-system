import { test } from "node:test";
import assert from "node:assert/strict";

import {
  credencialTemporal,
  ESPACIO_CREDENCIAL,
  normalizarUsuario,
  usuarioValido,
} from "./credenciales.ts";

/* La contraseña de alta de CADA cliente sale de acá. El generador anterior
   usaba Math.random() sobre 6 palabras (~54.000 combinaciones) y, como no
   había forma de cambiarla, era la clave definitiva del negocio para siempre. */

test("credencialTemporal: forma dictable palabra-NNNN", () => {
  for (let i = 0; i < 200; i++) {
    assert.match(credencialTemporal(), /^[a-z]{3,10}-\d{4}$/);
  }
});

test("credencialTemporal: sin acentos ni mayúsculas (se dicta por teléfono)", () => {
  for (let i = 0; i < 200; i++) {
    const c = credencialTemporal();
    assert.equal(c, c.toLowerCase());
    assert.equal(c.normalize("NFD"), c, `"${c}" trae un acento`);
  }
});

test("el espacio de claves es de otro orden que el anterior (~54.000)", () => {
  assert.ok(
    ESPACIO_CREDENCIAL >= 500_000,
    `espacio ${ESPACIO_CREDENCIAL}: 64 palabras × 9.000 números`,
  );
  assert.ok(ESPACIO_CREDENCIAL > 54_000 * 10);
});

test("credencialTemporal: no se repite ni colapsa a pocas palabras", () => {
  const muestras = new Set<string>();
  const palabras = new Set<string>();
  for (let i = 0; i < 1000; i++) {
    const c = credencialTemporal();
    muestras.add(c);
    palabras.add(c.split("-")[0]);
  }
  // Con 5,8·10⁵ combinaciones, 1000 muestras casi no deberían chocar.
  assert.ok(muestras.size > 980, `solo ${muestras.size} distintas de 1000`);
  // Y tienen que salir de toda la lista, no de un puñado.
  assert.ok(palabras.size >= 55, `solo ${palabras.size} palabras distintas`);
});

test("credencialTemporal: el número cubre el rango completo de 4 dígitos", () => {
  let min = 9999;
  let max = 1000;
  for (let i = 0; i < 2000; i++) {
    const n = Number(credencialTemporal().split("-")[1]);
    assert.ok(n >= 1000 && n <= 9999, `número fuera de rango: ${n}`);
    min = Math.min(min, n);
    max = Math.max(max, n);
  }
  assert.ok(min < 1500 && max > 9500, `rango observado ${min}-${max}`);
});

/* ── El usuario del empleado (bloque B): la MISMA normalización tiene que
   correr al crear y al entrar, o el empleado no entra nunca y parece que se
   equivocó de clave. ─────────────────────────────────────────────────────── */

test("normalizarUsuario: saca acentos, mayúsculas y todo lo que no sea a-z0-9", () => {
  assert.equal(normalizarUsuario("Martín"), "martin");
  assert.equal(normalizarUsuario("José Luis"), "joseluis");
  assert.equal(normalizarUsuario("  ANA  "), "ana");
  assert.equal(normalizarUsuario("caja-1"), "caja1");
  assert.equal(normalizarUsuario("Ñandú"), "nandu");
});

test("normalizarUsuario: es idempotente (crear y entrar dan lo mismo)", () => {
  for (const v of ["Martín", "José Luis", "caja-1", "Ñandú", "ANA"]) {
    assert.equal(normalizarUsuario(normalizarUsuario(v)), normalizarUsuario(v));
  }
});

test("usuarioValido: 3 a 20 caracteres ya normalizados", () => {
  assert.equal(usuarioValido("ana"), true);
  assert.equal(usuarioValido("Martín"), true);
  assert.equal(usuarioValido("jo"), false);
  assert.equal(usuarioValido("a-b"), false); // normaliza a "ab", 2 chars
  assert.equal(usuarioValido("x".repeat(21)), false);
  assert.equal(usuarioValido(""), false);
});
