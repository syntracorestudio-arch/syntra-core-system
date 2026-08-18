/**
 * SMOKE DE ACCESO — ¿se puede entrar a la app?
 *
 * POR QUÉ EXISTE. El 2026-08-18 la migración 055 agregó `members.created_by`
 * apuntando a `profiles`. Con eso `members` pasó a tener DOS caminos a
 * `profiles`, PostgREST no pudo desambiguar el embed `profiles!inner`, devolvió
 * PGRST201, `getSession` empezó a dar null y **TODA la app quedó sin acceso**:
 * cualquiera que entraba rebotaba al login.
 *
 * Lo que hace que valga la pena escribirlo: en ese momento estaban en verde
 * `tsc`, `lint`, `build`, 100 tests TS y 25 suites SQL. Ninguno podía verlo,
 * porque las suites SQL hablan con Postgres directo y los tests TS son lógica
 * pura: NADA tocaba PostgREST, que es por donde la app habla de verdad.
 *
 * Corre la consulta REAL de `getSession` —importando `SELECT_SESION`, no una
 * copia— con un token real. Si el embed se vuelve ambiguo otra vez, o alguien
 * revoca una columna que la sesión lee, esto se pone rojo acá y no en el
 * mostrador de un cliente.
 *
 *   npm run smoke:sesion
 */
import { readFile } from "node:fs/promises";
import { SELECT_SESION } from "../src/lib/session-select.ts";

const env = Object.fromEntries(
  (await readFile(new URL("../.env.local", import.meta.url), "utf8"))
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")]),
);

const URL_BASE = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!URL_BASE || !ANON) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL / ANON_KEY en .env.local");
  process.exit(1);
}

/* Cuentas del seed. Se prueban las DOS identidades porque son caminos
   distintos: el dueño entra con email real, el empleado con email sintético. */
const CUENTAS = [
  { que: "dueño", email: "dueno@escala.test", pass: "probando123" },
  { que: "empleada", email: "sofia.kiosco-escala@staff.stockflow.invalid", pass: "probando123" },
];

let fallo = false;

for (const c of CUENTAS) {
  const auth = await fetch(`${URL_BASE}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email: c.email, password: c.pass }),
  }).then((r) => r.json());

  if (!auth.access_token) {
    console.error(`✗ ${c.que}: no pudo autenticarse (${auth.error_description ?? auth.msg ?? "sin detalle"})`);
    fallo = true;
    continue;
  }

  /* La MISMA cadena que usa la app. supabase-js saca TODO el espacio en blanco
     antes de mandarla (no lo colapsa: lo elimina), así que acá se hace igual —
     con espacios adentro de los paréntesis, PostgREST responde PGRST100. */
  const select = encodeURIComponent(SELECT_SESION.replace(/\s/g, ""));
  const url =
    `${URL_BASE}/rest/v1/members?select=${select}` +
    `&profile_id=eq.${auth.user.id}&status=eq.active&store.status=eq.active&limit=1`;

  const res = await fetch(url, {
    headers: { apikey: ANON, Authorization: `Bearer ${auth.access_token}` },
  });
  const body = await res.json();

  if (!res.ok) {
    console.error(`✗ ${c.que}: PostgREST rechazó la consulta de sesión`);
    console.error(`   ${body.code ?? ""} ${body.message ?? ""}`);
    if (body.hint) console.error(`   pista: ${body.hint}`);
    fallo = true;
    continue;
  }
  if (!Array.isArray(body) || body.length === 0) {
    console.error(`✗ ${c.que}: la consulta anduvo pero NO devolvió membresía ⇒ getSession daría null ⇒ rebote al login`);
    fallo = true;
    continue;
  }

  const m = body[0];
  // Que la fila traiga lo que la sesión necesita, no sólo que exista.
  const faltan = ["id", "role", "store", "profile"].filter((k) => m[k] == null);
  if (faltan.length) {
    console.error(`✗ ${c.que}: la fila vino incompleta (falta ${faltan.join(", ")})`);
    fallo = true;
    continue;
  }

  console.log(`✓ ${c.que} entra — ${m.store.name} · rol ${m.role}`);
}

if (fallo) {
  console.error("\nSMOKE DE ACCESO EN ROJO: la app no deja entrar. No desplegar.");
  process.exit(1);
}
console.log("\n✓ Smoke de acceso OK: las dos identidades entran.");
