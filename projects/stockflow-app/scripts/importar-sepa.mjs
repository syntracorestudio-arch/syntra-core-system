/**
 * Importador del catálogo SEPA → `catalogo_publico`.
 *
 * SEPA es el Sistema Electrónico de Publicidad de Precios Argentinos
 * (Subsecretaría de Defensa del Consumidor). Publica a diario un ZIP por cada
 * día de la semana, con un ZIP anidado por cadena adentro.
 *
 *   Licencia: CC-BY 4.0 — solo exige atribución. Sin share-alike, así que no
 *   contamina nuestra base. Fuente: https://datos.produccion.gob.ar/dataset/sepa-precios
 *
 * De todo el dataset tomamos SOLO la identidad del producto (código, descripción
 * y marca). Los precios de las cadenas NO se importan: no son nuestro negocio y
 * mostrarlos confundiría al kiosquero, que fija los suyos.
 *
 * Uso:
 *   node scripts/importar-sepa.mjs            # descarga el día de hoy e importa
 *   node scripts/importar-sepa.mjs --dry-run  # normaliza y reporta, sin escribir
 *   node scripts/importar-sepa.mjs --file X   # usa un ZIP ya descargado
 *
 * Pensado para correr semanal. El snapshot descargado conviene archivarlo: SEPA
 * es un programa de gobierno y puede discontinuarse, pero el nombre de un
 * producto no caduca — un dump de hoy sirve dentro de tres años.
 */
import { createWriteStream } from "node:fs";
import { mkdtemp, open, readdir, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { createClient } from "@supabase/supabase-js";
import { normalizarDescripcion, normalizarMarca } from "./normalizar-producto.mjs";
import { abrirZip, abrirZipBuffer } from "./leer-zip.mjs";

const CKAN = "https://datos.produccion.gob.ar/api/3/action/package_show?id=sepa-precios";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
// `indexOf` devuelve -1 si no está, y args[-1 + 1] = args[0] = el flag anterior.
const iFile = args.indexOf("--file");
const fileArg = iFile >= 0 ? args[iFile + 1] : undefined;

/** Env desde .env.local (el script corre fuera de Next). */
async function env() {
  const txt = await readFile(new URL("../.env.local", import.meta.url), "utf8");
  return Object.fromEntries(
    txt
      .split("\n")
      .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
      }),
  );
}

/** El recurso del día de hoy, elegido del CKAN. */
async function urlDelDia() {
  const res = await fetch(CKAN);
  if (!res.ok) throw new Error(`CKAN respondió ${res.status}`);
  const { result } = await res.json();

  const dias = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
  const hoy = dias[new Date().getDay()];

  const recursos = (result.resources ?? []).filter((r) => r.format?.toUpperCase() === "ZIP");
  // El día está en la URL (sepa_miercoles.zip), no siempre en el nombre del
  // recurso: buscar en los dos evita bajar el archivo de otro día.
  const delDia =
    recursos.find((r) =>
      `${r.name ?? ""} ${r.url ?? ""}`.toLowerCase().includes(hoy),
    ) ?? recursos[0];

  if (!delDia) throw new Error("El dataset no expone ningún ZIP");
  return delDia.url;
}

async function descargar(url, destino) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`Descarga falló: ${res.status}`);

  // Readable.fromWeb explícito: pasar el ReadableStream de fetch directo a
  // pipeline truncaba el archivo EN SILENCIO (314 MB de 329 MB) y el error
  // recién aparecía como "esto no parece un archivo tar".
  await pipeline(Readable.fromWeb(res.body), createWriteStream(destino));

  const esperado = Number(res.headers.get("content-length") ?? 0);
  const { size } = await stat(destino);
  if (esperado && size !== esperado) {
    throw new Error(`Descarga incompleta: ${size} de ${esperado} bytes`);
  }

  // Un ZIP arranca con "PK". Si el servidor devolvió una página de error, mejor
  // decirlo acá que dejar que falle el descompresor con un mensaje críptico.
  // Se leen 2 bytes, no los 329 MB.
  const fh = await open(destino, "r");
  try {
    const { buffer } = await fh.read(Buffer.alloc(2), 0, 2, 0);
    if (buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
      throw new Error("Lo descargado no es un ZIP (¿el servidor devolvió un error?)");
    }
  } finally {
    await fh.close();
  }

  return destino;
}

/**
 * Decodifica un CSV de SEPA. El encoding varía POR CADENA: algunas publican
 * UTF-8 y otras Latin-1. Leer todo como UTF-8 rompe los acentos ("Jam�n"), que
 * es exactamente el error que hay que atajar acá y no aguas abajo.
 */
function decodificar(buf) {
  let texto = buf.toString("utf8");
  if (texto.includes("�")) texto = buf.toString("latin1");
  return texto.replace(/^﻿/, "");
}

/** Extrae {ean, descripcion, marca} de un productos.csv (pipe-delimited). */
function parsearProductos(texto) {
  const lineas = texto.split(/\r?\n/);
  if (lineas.length < 2) return [];

  const cols = lineas[0].split("|").map((c) => c.trim().toLowerCase());
  const iEan = cols.indexOf("id_producto");
  const iDesc = cols.indexOf("productos_descripcion");
  const iMarca = cols.indexOf("productos_marca");
  if (iEan < 0 || iDesc < 0) return [];

  const salida = [];
  for (let i = 1; i < lineas.length; i++) {
    const campos = lineas[i].split("|");
    if (campos.length <= iDesc) continue;

    const ean = (campos[iEan] ?? "").trim();
    // Solo EAN-13/EAN-8 reales: el dataset trae también códigos internos de
    // balanza que no sirven fuera de esa cadena.
    if (!/^\d{8,14}$/.test(ean) || ean.length < 8) continue;

    salida.push({
      ean,
      descripcion: (campos[iDesc] ?? "").trim(),
      marca: iMarca >= 0 ? (campos[iMarca] ?? "").trim() : null,
    });
  }
  return salida;
}

async function main() {
  const tmp = await mkdtemp(join(tmpdir(), "sepa-"));
  let zip = fileArg;

  try {
    if (!zip) {
      const url = await urlDelDia();
      console.log(`Descargando ${url}`);
      zip = await descargar(url, join(tmp, "sepa.zip"));
      const { size } = await stat(zip);
      console.log(`  ${(size / 1024 / 1024).toFixed(0)} MB`);
    }

    console.log("Abriendo el archivo…");
    const externo = await abrirZip(zip);

    // Estructura: el ZIP del día contiene un ZIP por cadena, y adentro de cada
    // uno está productos.csv. Se procesan en memoria, sin escribir a disco.
    const anidados = externo.entradas.filter((e) => e.nombre.toLowerCase().endsWith(".zip"));
    console.log(`  ${anidados.length} cadenas`);

    /** Mejor candidato por EAN: la descripción más informativa gana. */
    const mejor = new Map();
    let filas = 0;

    for (const cadena of anidados) {
      let productos = [];
      try {
        const buf = await externo.leer(cadena.nombre);
        const interno = await abrirZipBuffer(buf);
        const csv = interno.entradas.find((e) =>
          e.nombre.toLowerCase().endsWith("productos.csv"),
        );
        if (!csv) continue;
        productos = parsearProductos(decodificar(await interno.leer(csv.nombre)));
      } catch (err) {
        // Una cadena con el ZIP corrupto no puede tirar abajo la importación:
        // el resto del dataset sigue sirviendo.
        console.warn(`  ⚠ ${cadena.nombre.split("/").pop()}: ${err.message}`);
        continue;
      }

      filas += productos.length;
      for (const p of productos) {
        const nombre = normalizarDescripcion(p.descripcion);
        if (!nombre) continue;
        const marca = normalizarMarca(p.marca);
        const previo = mejor.get(p.ean);

        // Entre dos descripciones del mismo producto, gana la más larga: las
        // cadenas truncan a distinto largo y la más larga perdió menos.
        if (!previo || nombre.length > previo.nombre.length) {
          mejor.set(p.ean, { ean: p.ean, nombre, marca, vistas: (previo?.vistas ?? 0) + 1 });
        } else {
          previo.vistas += 1;
        }
      }
    }

    console.log(`\n  Filas leídas:      ${filas.toLocaleString()}`);
    console.log(`  Productos únicos:  ${mejor.size.toLocaleString()}`);
    const conMarca = [...mejor.values()].filter((p) => p.marca).length;
    console.log(`  Con marca:         ${conMarca.toLocaleString()} (${((conMarca / mejor.size) * 100).toFixed(0)}%)`);

    if (dryRun) {
      console.log("\n--dry-run: no se escribió nada. Muestra:");
      for (const p of [...mejor.values()].slice(0, 8)) {
        console.log(`  ${p.ean}  ${p.nombre}${p.marca ? `  · ${p.marca}` : ""}`);
      }
      return;
    }

    const e = await env();
    const admin = createClient(e.NEXT_PUBLIC_SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // De a 1000: un upsert de 80k filas en una sola llamada muere por timeout.
    const filasUpsert = [...mejor.values()].map((p) => ({
      ean: p.ean,
      nombre: p.nombre,
      marca: p.marca,
      fuente: "sepa",
      confirmaciones: Math.max(1, p.vistas),
      actualizado_at: new Date().toISOString(),
    }));

    let escritas = 0;
    for (let i = 0; i < filasUpsert.length; i += 1000) {
      const lote = filasUpsert.slice(i, i + 1000);
      const { error } = await admin.from("catalogo_publico").upsert(lote, { onConflict: "ean" });
      if (error) {
        console.error(`  ✗ lote ${i}: ${error.message}`);
        continue;
      }
      escritas += lote.length;
      if (i % 10000 === 0) process.stdout.write(`\r  Escribiendo… ${escritas.toLocaleString()}`);
    }
    console.log(`\r  ✓ ${escritas.toLocaleString()} productos en el catálogo`);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error("Falló la importación:", err.message);
  process.exit(1);
});
