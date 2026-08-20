/**
 * CREAR (O RECUPERAR) EL SUPERADMIN DE LA PLATAFORMA.
 *
 * POR QUÉ EXISTE. La migración 056 dice, textual, que su bootstrap está para
 * que "el acceso del owner sobreviva a un reset de la base" (056:86-88). No lo
 * cumple, y es fácil de ver:
 *
 *   update public.profiles set is_superadmin = true
 *    where lower(email) = lower('syntracore.studio@gmail.com');
 *
 * En una base NUEVA eso no matchea ninguna fila. Las migraciones corren antes
 * de que exista ningún usuario, no hay signup público (el onboarding es
 * controlado), y `otorgar_superadmin` exige un superadmin que ya exista para
 * poder otorgar. Círculo cerrado: nadie puede entrar nunca a /super.
 *
 * En local no se nota porque el entorno arranca con `seed.sql`, que sí inserta
 * en `auth.users` — pero `seed.sql` corre en `db reset` y NUNCA en producción.
 *
 * POR QUÉ UN SCRIPT Y NO UNA MIGRACIÓN. Una contraseña no se puede setear desde
 * SQL: `auth.users.encrypted_password` es de GoTrue y el único camino soportado
 * es su Admin API. Una migración puede prender el flag de un perfil que YA
 * exista; no puede crear la cuenta. Por eso la migración queda como red de
 * seguridad y esto es el camino real.
 *
 * ES IDEMPOTENTE: correrlo dos veces no rompe nada. Si la cuenta existe, le
 * actualiza la contraseña y se asegura del flag.
 *
 *   npm run superadmin:crear -- --email=vos@ejemplo.com
 *
 * La contraseña se pide por teclado y NO se muestra: pasarla por argumento la
 * dejaría en el historial del shell. En un entorno sin terminal interactiva
 * (CI) se acepta `SUPERADMIN_PASSWORD`, que es peor pero a veces es lo único.
 */
import { readFile } from "node:fs/promises";
import { createInterface } from "node:readline";

/* ── entorno ────────────────────────────────────────────────────────────── */

/**
 * `.env.local` en desarrollo; en el deploy las variables ya vienen en el
 * proceso. Se prueba el archivo primero y se cae a `process.env` sin ruido:
 * este script tiene que correr igual en la máquina del owner y en el server.
 */
async function cargarEntorno() {
  let delArchivo = {};
  try {
    const txt = await readFile(new URL("../.env.local", import.meta.url), "utf8");
    delArchivo = Object.fromEntries(
      txt
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("#") && l.includes("="))
        .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")]),
    );
  } catch {
    /* No existe: estamos en el server, con las variables ya en el proceso. */
  }
  return { ...delArchivo, ...process.env };
}

const env = await cargarEntorno();
const URL_BASE = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL_BASE || !SERVICE) {
  console.error(
    "Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.\n" +
      "En local van en .env.local; en el deploy, como variables de entorno.",
  );
  process.exit(1);
}

/* ── argumentos ─────────────────────────────────────────────────────────── */

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .filter((a) => a.startsWith("--"))
    .map((a) => {
      const i = a.indexOf("=");
      return i === -1 ? [a.slice(2), "true"] : [a.slice(2, i), a.slice(i + 1)];
    }),
);

const email = (args.email ?? env.SUPERADMIN_EMAIL ?? "").trim().toLowerCase();
const nombre = (args.nombre ?? "SYNTRA").trim();

if (!email || !email.includes("@")) {
  console.error("Falta el email: npm run superadmin:crear -- --email=vos@ejemplo.com");
  process.exit(1);
}

/* ── contraseña ─────────────────────────────────────────────────────────── */

/** Pide por teclado sin eco. El prompt se escribe ANTES de mutear la salida. */
function preguntarOculto(texto) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    process.stdout.write(texto);
    // Silencia el eco de readline: sin esto la contraseña queda en pantalla.
    rl._writeToOutput = () => {};
    rl.question("", (v) => {
      rl.close();
      process.stdout.write("\n");
      resolve(v);
    });
  });
}

/**
 * 12 caracteres, no 6 (el mínimo de GoTrue). Esta cuenta ve TODOS los negocios
 * de la plataforma y puede suspender cualquiera: es la credencial más valiosa
 * del sistema y, por decisión del owner, es de un solo factor.
 */
const MINIMO = 12;

let password = env.SUPERADMIN_PASSWORD ?? "";
if (!password) {
  if (!process.stdin.isTTY) {
    console.error(
      "No hay terminal interactiva y no vino SUPERADMIN_PASSWORD.\n" +
        "Corrélo a mano, o pasá la variable si es un entorno automatizado.",
    );
    process.exit(1);
  }
  password = await preguntarOculto(`Contraseña para ${email} (mínimo ${MINIMO}): `);
  const otra = await preguntarOculto("Repetila: ");
  if (password !== otra) {
    console.error("No coinciden. No se tocó nada.");
    process.exit(1);
  }
}

if (password.length < MINIMO) {
  console.error(`La contraseña tiene que tener al menos ${MINIMO} caracteres. No se tocó nada.`);
  process.exit(1);
}

/* ── API ────────────────────────────────────────────────────────────────── */

const cabeceras = {
  apikey: SERVICE,
  Authorization: `Bearer ${SERVICE}`,
  "Content-Type": "application/json",
};

async function api(ruta, opciones = {}) {
  /* Los headers se MEZCLAN, no se pisan: con `headers: cabeceras` a secas, el
     `Prefer: return=representation` del PATCH se perdía y PostgREST devolvía
     204 sin cuerpo — la verificación de abajo lo leía como "no se actualizó
     nada" y abortaba con la cuenta ya creada. */
  const r = await fetch(`${URL_BASE}${ruta}`, {
    ...opciones,
    headers: { ...cabeceras, ...(opciones.headers ?? {}) },
  });
  const texto = await r.text();
  let cuerpo = null;
  try {
    cuerpo = texto ? JSON.parse(texto) : null;
  } catch {
    cuerpo = texto;
  }
  return { ok: r.ok, status: r.status, cuerpo };
}

/**
 * Todo lo que habla con la API vive dentro de main() por una razon concreta:
 * salir con `process.exit()` inmediatamente despues de un `fetch` mata el
 * proceso con sockets a medio cerrar. En Windows eso dispara una assertion de
 * libuv y el codigo de salida sale 127 ("comando no encontrado") en vez de 1 —
 * o sea que un script que hizo lo correcto reporta un error que no es el suyo,
 * y cualquier automatizacion que lo llame lee la falla equivocada.
 * Con `exitCode` + `return`, el proceso termina solo cuando los sockets cierran.
 */
async function main() {
  /* ── 1 · ¿ya existe? ────────────────────────────────────────────────────── */

  /* Se busca por `profiles` y no listando usuarios de auth: `profiles` es 1:1 con
     `auth.users` (trigger `on_auth_user_created`), tiene el email y se consulta
     con un filtro indexado en vez de paginar la lista entera. */
  const buscado = await api(
    `/rest/v1/profiles?select=id,email,is_superadmin&email=eq.${encodeURIComponent(email)}`,
  );

  if (!buscado.ok) {
    console.error("No pudimos consultar los perfiles:", buscado.status, buscado.cuerpo);
    process.exitCode = 1;
      return;
  }

  let profileId = Array.isArray(buscado.cuerpo) && buscado.cuerpo[0] ? buscado.cuerpo[0].id : null;
  const yaEraSuperadmin = Array.isArray(buscado.cuerpo) && buscado.cuerpo[0]?.is_superadmin === true;

  /* ── 1b · que no sea el dueño de un kiosco ──────────────────────────────── */

  /* GUARDA CONTRA UN ACCIDENTE CARO. Sin esto, correr el script con el email de
     un cliente por error hace DOS cosas silenciosas a la vez: le cambia la
     contraseña (lo deja afuera de su negocio, sin aviso) y lo convierte en
     superadmin de la plataforma — o sea que pasa a ver y poder suspender los
     kioscos de todos los demás.
     Es exactamente la escalada que cerró la 049, entrando por la puerta de
     servicio. Se puede saltear a propósito con --forzar, pero no por descuido. */
  if (profileId) {
    const miembro = await api(
      `/rest/v1/members?select=role,store:stores!inner(name)&profile_id=eq.${profileId}&status=eq.active`,
    );
    const filas = Array.isArray(miembro.cuerpo) ? miembro.cuerpo : [];
    if (filas.length > 0 && args.forzar !== "true") {
      const donde = filas
        .map((m) => `${m.store?.name ?? "un negocio"} (${m.role})`)
        .join(", ");
      console.error(
        [
          `${email} ya trabaja en un negocio de la plataforma: ${donde}.`,
          "Darle superadmin lo dejaría ver y suspender los kioscos de todos, y este",
          "script además le cambiaría la contraseña.",
          "Usá una cuenta aparte para la plataforma, o repetilo con --forzar si de",
          "verdad es lo que querés.",
        ].join("\n"),
      );
      process.exitCode = 1;
      return;
    }
  }

  /* ── 2 · crear o actualizar la cuenta ───────────────────────────────────── */

  if (profileId) {
    const r = await api(`/auth/v1/admin/users/${profileId}`, {
      method: "PUT",
      body: JSON.stringify({ password, email_confirm: true }),
    });
    if (!r.ok) {
      console.error("No pudimos actualizar la contraseña:", r.status, r.cuerpo);
      process.exitCode = 1;
      return;
    }
    console.log(`· Cuenta existente: contraseña actualizada (${email}).`);
  } else {
    const r = await api("/auth/v1/admin/users", {
      method: "POST",
      body: JSON.stringify({
        email,
        password,
        // No hay SMTP todavía (el dominio está pendiente): se confirma acá mismo,
        // igual que en el alta de un kiosco.
        email_confirm: true,
        user_metadata: { full_name: nombre },
      }),
    });

    if (!r.ok) {
      /* Caso borde real: existe el usuario de auth pero NO su fila en `profiles`
         (el trigger falló alguna vez). La búsqueda de arriba no lo encuentra y la
         creación choca. Se nombra explícito porque el mensaje crudo de GoTrue no
         dice qué hacer. */
      const msg = JSON.stringify(r.cuerpo ?? "");
      if (msg.toLowerCase().includes("already")) {
        console.error(
          `Ya existe un usuario de auth con ${email} pero no tiene fila en profiles.\n` +
            "Es el trigger on_auth_user_created que no corrió. Insertá el profile a mano\n" +
            "con el id de auth.users y volvé a correr esto.",
        );
        process.exitCode = 1;
      return;
      }
      console.error("No pudimos crear el usuario:", r.status, r.cuerpo);
      process.exitCode = 1;
      return;
    }

    profileId = r.cuerpo.id;
    console.log(`· Cuenta creada (${email}).`);
  }

  /* ── 3 · el flag ────────────────────────────────────────────────────────── */

  /* `must_change_password` va en false a propósito: el trigger lo prende para
     TODA cuenta nueva (049:97), y tiene sentido para un cliente al que le
     dictamos una clave temporal por teléfono. Acá la contraseña la eligió el
     dueño de la plataforma recién ahora, así que no hay nada que cambiar — y
     además /super no mira ese flag (requireSuperadmin no pasa por getSession),
     con lo cual dejarlo prendido no forzaría nada: sólo mentiría. */
  const actualizado = await api(`/rest/v1/profiles?id=eq.${profileId}`, {
    method: "PATCH",
    headers: { ...cabeceras, Prefer: "return=representation" },
    body: JSON.stringify({ is_superadmin: true, must_change_password: false }),
  });

  if (!actualizado.ok || !Array.isArray(actualizado.cuerpo) || actualizado.cuerpo.length === 0) {
    console.error(
      "La cuenta quedó creada PERO no pudimos prender is_superadmin:",
      actualizado.status,
      actualizado.cuerpo,
    );
    process.exitCode = 1;
      return;
  }

  console.log(
    yaEraSuperadmin
      ? "· Ya era superadmin: el flag se confirmó."
      : "· is_superadmin activado.",
  );
  console.log(`\nListo. Entrá con ${email} y escribí /super a mano.`);
}

await main();
