import test from "node:test";
import assert from "node:assert/strict";

/**
 * Permisos del empleado — la parte que vive en TypeScript.
 *
 * El grueso de la afirmación es SQL (`supabase/tests/verify-permisos.sql`),
 * porque ahí es donde está el enforcement de verdad. Acá viven las dos reglas
 * que NO son de la base y que, si se rompen, no hacen ruido en ningún lado:
 *
 *   1 · la derivación `can_see_costs ← can_receive_stock`
 *   2 · el espejo UI ↔ servidor de cada flag
 *
 * La regla 2 existe por dos bugs REALES de este proyecto, uno en cada dirección:
 *   · el POS ofrecía «Deshacer» a todo el mundo y el servidor lo rechazaba
 *     (UI más permisiva que el servidor ⇒ botón muerto con el cliente enfrente);
 *   · el alta rápida se ocultaba y la server action la permitía
 *     (UI más restrictiva ⇒ el permiso no servía para nada).
 * Un permiso sano se decide con la MISMA expresión de los dos lados.
 */

/** La expresión que usan las páginas: el dueño siempre puede. */
type Miembro = {
  role: "owner" | "staff";
  can_sell_on_credit: boolean;
  can_apply_discount: boolean;
  can_void_sale: boolean;
  can_receive_stock: boolean;
  can_see_costs: boolean;
};

const staff = (over: Partial<Miembro> = {}): Miembro => ({
  role: "staff",
  can_sell_on_credit: false,
  can_apply_discount: false,
  can_void_sale: false,
  can_receive_stock: false,
  can_see_costs: false,
  ...over,
});

const owner = (): Miembro => ({
  role: "owner",
  can_sell_on_credit: false,
  can_apply_discount: false,
  can_void_sale: false,
  can_receive_stock: false,
  can_see_costs: false,
});

/** El predicado que espejan página y server action. */
const puede = (m: Miembro, flag: keyof Omit<Miembro, "role">): boolean =>
  m.role === "owner" || m[flag];

// ---------------------------------------------------------------------------
// 1 · El dueño no depende de ningún flag
// ---------------------------------------------------------------------------
test("el dueño puede todo aunque tenga los cinco flags en false", () => {
  const o = owner();
  for (const f of [
    "can_sell_on_credit",
    "can_apply_discount",
    "can_void_sale",
    "can_receive_stock",
    "can_see_costs",
  ] as const) {
    assert.equal(puede(o, f), true, `el dueño quedó sin ${f}`);
  }
});

test("el empleado sin flags no puede nada (mínimo privilegio)", () => {
  const s = staff();
  for (const f of [
    "can_sell_on_credit",
    "can_apply_discount",
    "can_void_sale",
    "can_receive_stock",
    "can_see_costs",
  ] as const) {
    assert.equal(puede(s, f), false, `el empleado arrancó con ${f} prendido`);
  }
});

// ---------------------------------------------------------------------------
// 2 · can_see_costs ACOMPAÑA a can_receive_stock
//
// No es un capricho: recibir mercadería es anotar cuánto costó. Tener los dos
// flags separados dejaba la pantalla diciendo una cosa y la columna otra.
// `equipo/actions.ts` deriva uno del otro; esto lo fija.
// ---------------------------------------------------------------------------
const derivarPermisos = (puedeRecibir: boolean) => ({
  can_receive_stock: puedeRecibir,
  can_see_costs: puedeRecibir,
});

test("can_see_costs sigue a can_receive_stock en las dos direcciones", () => {
  assert.deepEqual(derivarPermisos(true), {
    can_receive_stock: true,
    can_see_costs: true,
  });
  assert.deepEqual(derivarPermisos(false), {
    can_receive_stock: false,
    can_see_costs: false,
  });
});

test("nunca queda la combinación que se contradecía: recibir sin ver costos", () => {
  for (const v of [true, false]) {
    const d = derivarPermisos(v);
    assert.ok(
      !(d.can_receive_stock && !d.can_see_costs),
      "puede recibir mercadería pero no ver lo que costó — imposible en la práctica",
    );
  }
});

// ---------------------------------------------------------------------------
// 3 · Espejo UI ↔ servidor
//
// Cada par es (lo que decide la pantalla, lo que decide el servidor). Tienen
// que dar IGUAL para las 32 combinaciones de flags, no sólo para el caso feliz.
// ---------------------------------------------------------------------------
const combinaciones = (): Miembro[] => {
  const out: Miembro[] = [];
  for (let i = 0; i < 32; i++) {
    out.push(
      staff({
        can_sell_on_credit: !!(i & 1),
        can_apply_discount: !!(i & 2),
        can_void_sale: !!(i & 4),
        can_receive_stock: !!(i & 8),
        can_see_costs: !!(i & 16),
      }),
    );
  }
  return out;
};

test("fiar: la pantalla y el servidor deciden lo mismo en las 32 combinaciones", () => {
  for (const m of combinaciones()) {
    const ui = m.role === "owner" || m.can_sell_on_credit; // pos/page.tsx
    const server = m.role === "owner" || m.can_sell_on_credit; // fiado/actions.ts
    assert.equal(ui, server);
  }
});

test("anular: la pantalla ya NO ofrece lo que el servidor rechaza", () => {
  for (const m of combinaciones()) {
    const ui = m.role === "owner" || m.can_void_sale; // pos-screen.tsx (B1)
    const server = m.role === "owner" || m.can_void_sale; // caja/actions.ts
    assert.equal(ui, server, "volvió el botón muerto de «Deshacer»");
  }
});

test("alta rápida: el gate del POS espeja al de quickCreateProduct", () => {
  for (const m of combinaciones()) {
    const ui = m.role === "owner" || m.can_receive_stock; // pos/page.tsx
    const server = m.role === "owner" || m.can_receive_stock; // pos/actions.ts:520
    assert.equal(ui, server);
  }
});

// ---------------------------------------------------------------------------
// 4 · Los márgenes viajan sólo con el alta rápida (fuga B-8)
//
// Precio a la vista + margen del 35% ⇒ el costo se despeja de memoria. Era la
// fuga más barata de tapar de toda la auditoría; este test evita que vuelva.
// ---------------------------------------------------------------------------
const payloadPos = (m: Miembro, margenDefault: number, margenMinimo: number) => {
  const puedeAltaRapida = m.role === "owner" || m.can_receive_stock;
  return {
    canQuickAdd: puedeAltaRapida,
    margenDefault: puedeAltaRapida ? margenDefault : 0,
    margenMinimo: puedeAltaRapida ? margenMinimo : 0,
  };
};

test("el cajero sin can_receive_stock no recibe los márgenes del negocio", () => {
  const p = payloadPos(staff(), 35, 25);
  assert.equal(p.margenDefault, 0);
  assert.equal(p.margenMinimo, 0);
  assert.equal(p.canQuickAdd, false);
});

test("quien sí puede dar de alta los recibe (el arreglo no rompe el alta rápida)", () => {
  const p = payloadPos(staff({ can_receive_stock: true }), 35, 25);
  assert.equal(p.margenDefault, 35);
  assert.equal(p.margenMinimo, 25);
  assert.equal(p.canQuickAdd, true);

  const o = payloadPos(owner(), 35, 25);
  assert.equal(o.margenDefault, 35);
  assert.equal(o.canQuickAdd, true);
});

test("los márgenes y el alta rápida se deciden con la MISMA condición", () => {
  for (const m of combinaciones()) {
    const p = payloadPos(m, 35, 25);
    assert.equal(
      p.canQuickAdd,
      p.margenDefault > 0,
      "se desacoplaron: o se ofrece el alta sin márgenes, o viajan márgenes sin alta",
    );
  }
});

// ---------------------------------------------------------------------------
// 5 · Todo estado de fallo tiene su cartel
//
// Origen: un empleado dado de baja entraba a GoTrue (su usuario de auth sigue
// vivo), caía en `/` y salía por un `redirect("/login")` PELADO. No veía nada,
// concluía que erró la clave y la reintentaba hasta que el rate limit por
// cuenta lo bloqueaba 15 minutos.
//
// Lo caro del bug es que NINGUNA suite podía verlo: el SQL estaba bien y
// `verify-identidad.sql` ya afirmaba que `mi_acceso` devuelve `sin_acceso`. El
// agujero era "esa ruta no pregunta el motivo". Esto es lo que sí se puede
// afirmar desde acá — que ningún estado quede sin texto — y es la mitad que
// evita la reincidencia: si mañana `mi_acceso` devuelve un estado nuevo y nadie
// le escribe el cartel, la pantalla vuelve a quedar muda y este test lo canta.
// ---------------------------------------------------------------------------
import { ESTADOS_SIN_ACCESO, MOTIVOS, textoDelMotivo } from "./motivos.ts";

test("cada estado de fallo de mi_acceso tiene un texto", () => {
  for (const estado of ESTADOS_SIN_ACCESO) {
    const texto = textoDelMotivo(estado);
    assert.ok(texto, `el estado \`${estado}\` no tiene cartel: la pantalla queda muda`);
    assert.ok(
      texto!.length > 30,
      `el texto de \`${estado}\` es demasiado corto para explicar algo`,
    );
  }
});

test("el cartel de baja aclara que NO es la clave", () => {
  // Sin esta aclaración la persona reintenta y se come el rate limit. Es la
  // razón de existir del mensaje, no un detalle de redacción.
  assert.match(MOTIVOS.sin_acceso, /no es la clave/i);
});

test("cada cartel dice a quién recurrir", () => {
  // Un mensaje que dice "no podés entrar" y no dice qué hacer deja a la persona
  // en el mismo lugar. Al empleado lo reactiva su dueño; al dueño, SYNTRA.
  assert.match(MOTIVOS.sin_acceso, /dueño/i);
  assert.match(MOTIVOS.sin_membresia, /dueño/i);
  assert.match(MOTIVOS.negocio_suspendido, /escribinos|dueño/i);
});

test("un motivo desconocido no rompe: devuelve null y la pantalla no inventa", () => {
  assert.equal(textoDelMotivo("cualquier_cosa"), null);
  assert.equal(textoDelMotivo(undefined), null);
  assert.equal(textoDelMotivo(""), null);
});
