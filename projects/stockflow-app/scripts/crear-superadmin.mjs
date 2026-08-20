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
 * La contraseña se pide por TECLADO y nunca por argumento: un argumento queda
 * escrito para siempre en el historial del shell. En PowerShell y cmd además se
 * escribe sin eco; en Git Bash se ve (ver `puedeOcultar`), y se avisa.
 * En entornos sin consola (CI) se acepta `SUPERADMIN_PASSWORD`.
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

/**
 * ¿Podemos apagar el eco del teclado?
 *
 * En Git Bash / MinTTY (MSYS2, que es la terminal por defecto de Git en
 * Windows) Node NO recibe una TTY: MinTTY conecta el proceso con pipes en vez
 * de con handles de consola de Windows, así que `process.stdin.isTTY` queda
 * `undefined` y `setRawMode` no existe. En PowerShell y en cmd sí hay TTY.
 *
 * La primera versión de este script exigía TTY y abortaba si no la había — con
 * el resultado de que en Git Bash no se podía crear la cuenta: el comando
 * quedaba colgado sin mostrar siquiera el prompt.
 */
const puedeOcultar = Boolean(process.stdin.isTTY) && typeof process.stdin.setRawMode === "function";

/**
 * Abre UNA sola lectura de teclado para las dos preguntas.
 *
 * Si se puede, se apaga el eco. Si no —Git Bash—, se pide igual y se avisa que
 * se va a ver: mostrarla en TU terminal, en TU máquina, es un riesgo bajo, y
 * bastante menor que el que este script venía a evitar (que la contraseña quede
 * escrita para siempre en el historial del shell).
 *
 * Con una interfaz por pregunta, el `close()` de la primera deja `stdin`
 * consumido y la segunda recibe EOF al instante: pedía la contraseña, y al
 * repetirla fallaba sola sin que el usuario tipeara nada.
 */
function abrirTeclado() {
  const rl = puedeOcultar
    ? createInterface({ input: process.stdin, output: process.stdout, terminal: true })
    : createInterface({ input: process.stdin });

  if (puedeOcultar) rl._writeToOutput = () => {};

  /* COLA DE LÍNEAS, y no `rl.question` por pregunta.
     Con stdin no interactiva (un pipe, que es lo que da MinTTY) readline emite
     TODAS las líneas disponibles de una y después cierra. Con `question`, la
     primera consumía su línea, el stream cerraba, y la segunda pregunta moría
     con "stdin cerrado" sin que el usuario llegara a tipear nada. Guardando las
     líneas a medida que llegan, da igual si vienen juntas o de a una. */
  const pendientes = [];
  const esperando = [];
  let cerrado = false;

  rl.on("line", (v) => {
    const q = esperando.shift();
    if (q) q.resolve(v);
    else pendientes.push(v);
  });

  rl.on("close", () => {
    cerrado = true;
    while (esperando.length) {
      esperando.shift().reject(
        new Error(
          [
            "No se pudo leer del teclado (stdin cerrado).",
            "Probá en PowerShell, o pasá SUPERADMIN_PASSWORD como variable de entorno.",
          ].join("\n"),
        ),
      );
    }
  });

  return {
    /**
     * El prompt va a STDERR y no a stdout: stdout puede estar bufferizado o
     * redirigido (npm run envuelve el proceso), y un prompt que no se ve es,
     * para el que lo corre, un programa colgado. Fue exactamente el síntoma
     * reportado.
     */
    preguntar(texto) {
      process.stderr.write(texto);
      // Con el eco apagado el Enter tampoco se ve: el salto lo ponemos nosotros.
      const cerrarLinea = () => {
        if (puedeOcultar) process.stderr.write("\n");
      };

      if (pendientes.length) {
        cerrarLinea();
        return Promise.resolve(pendientes.shift());
      }
      if (cerrado) {
        return Promise.reject(new Error("No se pudo leer del teclado (stdin cerrado)."));
      }
      return new Promise((resolve, reject) => {
        esperando.push({
          resolve: (v) => {
            cerrarLinea();
            resolve(v);
          },
          reject,
        });
      });
    },
    cerrar() {
      rl.close();
    },
  };
}

/**
 * 8 caracteres — decisión del owner (2026-08-19), sobre el 6 que trae GoTrue.
 *
 * Queda anotado para cuando se retome el tema: esta cuenta ve TODOS los negocios
 * de la plataforma y puede suspender cualquiera, y se defiende con un solo
 * factor (2FA descartada). El freno real hoy es el rate limit del login del
 * panel, que es fail-closed y muy apretado (3 intentos por cuenta cada 30
 * minutos); el largo de la clave pesa sobre todo si esa cuenta se reusa en otro
 * lado, donde una filtración ajena se convierte en acceso a la plataforma.
 */
const MINIMO = 8;

let password = env.SUPERADMIN_PASSWORD ?? "";
if (!password) {
  if (!puedeOcultar) {
    process.stderr.write(
      "· Esta terminal no deja ocultar lo que tipeás (pasa en Git Bash).\n" +
        "  La contraseña se va a VER en pantalla. Si preferís que no, cortá con\n" +
        "  Ctrl+C y corré el mismo comando en PowerShell.\n\n",
    );
  }
  const teclado = abrirTeclado();
  try {
    password = await teclado.preguntar(`Contraseña para ${email} (mínimo ${MINIMO}): `);
    const otra = await teclado.preguntar("Repetila: ");
    if (password !== otra) {
      console.error("No coinciden. No se tocó nada.");
      process.exit(1);
    }
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  } finally {
    teclado.cerrar();
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
