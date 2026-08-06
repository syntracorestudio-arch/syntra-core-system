/**
 * Tests de enlaces.ts — la parte del reporte que convierte una oportunidad en
 * una acción. Si el link cae en la pantalla equivocada (o peor: no cae en
 * ninguna), el email vuelve a ser algo que se lee y se olvida.
 *
 * Se corre con: node --test src/lib/asistente/enlaces.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { rutaOportunidad, absolutizar, baseEfimera, ctaOportunidad } from "./enlaces.ts";

// ── Rutas ──────────────────────────────────────────────────────────────────────

test("remarcar cae en Precios, que ya lista exactamente los erosionados", () => {
  assert.equal(rutaOportunidad("remarcar", { desde: "2026-07-01" }), "/admin/precios");
});

test("stock muerto cae en Reportes del MISMO mes del reporte, no del mes corriente", () => {
  const r = rutaOportunidad("stock_muerto", { desde: "2026-07-01" });
  assert.equal(r, "/admin/reportes?p=mes&d=2026-07-01#stock-muerto");
});

test("fiado cae en la pantalla de fiado", () => {
  assert.equal(rutaOportunidad("fiado", { desde: "2026-07-01" }), "/admin/fiado");
});

test("una fecha inválida no rompe el link: cae en Reportes sin acotar el período", () => {
  assert.equal(rutaOportunidad("stock_muerto", { desde: "julio" }), "/admin/reportes#stock-muerto");
  assert.equal(rutaOportunidad("stock_muerto", { desde: "" }), "/admin/reportes#stock-muerto");
});

// ── Absolutización ─────────────────────────────────────────────────────────────

test("arma la URL absoluta con la base de la app", () => {
  assert.equal(
    absolutizar("https://app.stockflow.ar", "/admin/precios"),
    "https://app.stockflow.ar/admin/precios",
  );
});

test("tolera la barra final de la base (error clásico de env var)", () => {
  assert.equal(
    absolutizar("https://app.stockflow.ar///", "/admin/precios"),
    "https://app.stockflow.ar/admin/precios",
  );
});

test("sin base configurada devuelve null: el email se manda igual, sin botones", () => {
  assert.equal(absolutizar(undefined, "/admin/precios"), null);
  assert.equal(absolutizar("", "/admin/precios"), null);
  assert.equal(absolutizar("   ", "/admin/precios"), null);
});

test("rechaza bases que no sean http(s) — un mail no linkea a javascript: ni a file:", () => {
  assert.equal(absolutizar("javascript:alert(1)", "/admin/precios"), null);
  assert.equal(absolutizar("file:///c:/", "/admin/precios"), null);
  assert.equal(absolutizar("app.stockflow.ar", "/admin/precios"), null);
});

test("acepta http en desarrollo (localhost con puerto)", () => {
  assert.equal(absolutizar("http://localhost:3100", "/admin/fiado"), "http://localhost:3100/admin/fiado");
});

// ── Texto del botón ────────────────────────────────────────────────────────────

test("el botón dice cuántos son: el número es la razón para tocarlo", () => {
  assert.equal(ctaOportunidad("remarcar", 6, "productos"), "Ver los 6 productos");
  assert.equal(ctaOportunidad("stock_muerto", 5, "productos"), "Ver los 5 productos parados");
  assert.equal(ctaOportunidad("fiado", 3, "productos"), "Ver los 3 clientes");
});

test("singular sin quedar mal escrito", () => {
  assert.equal(ctaOportunidad("remarcar", 1, "productos"), "Ver el producto");
  assert.equal(ctaOportunidad("stock_muerto", 1, "productos"), "Ver el producto parado");
  assert.equal(ctaOportunidad("fiado", 1, "productos"), "Ver el cliente");
});

test("respeta el sustantivo del rubro (una farmacia no vende 'productos')", () => {
  assert.equal(ctaOportunidad("remarcar", 4, "medicamentos"), "Ver los 4 medicamentos");
  assert.equal(ctaOportunidad("stock_muerto", 1, "medicamentos"), "Ver el medicamento parado");
});

test("sin cantidad conocida el botón sigue existiendo", () => {
  assert.equal(ctaOportunidad("remarcar", 0, "productos"), "Abrir StockFlow");
});

test("una URL base de túnel o localhost se marca como pasajera", () => {
  // Caso real: el reporte salió con NEXT_PUBLIC_APP_URL apuntando a un túnel de
  // Cloudflare que ya estaba muerto cuando el owner abrió el mail.
  for (const b of [
    "https://tent-flights-pads-blake.trycloudflare.com",
    "http://localhost:3000",
    "https://abc.ngrok-free.app",
  ]) {
    assert.equal(baseEfimera(b), true, b);
  }
  assert.equal(baseEfimera("https://app.stockflow.com.ar"), false);
  assert.equal(baseEfimera(null), false);
});
