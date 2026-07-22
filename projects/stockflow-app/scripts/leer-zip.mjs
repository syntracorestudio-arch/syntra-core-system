/**
 * Lector de ZIP mínimo sobre `zlib` (módulo nativo de Node).
 *
 * Por qué existe: el `tar` de Windows no puede con los ZIP de SEPA ("This does
 * not look like a tar archive") aunque .NET los abra sin problema, y depender de
 * PowerShell dejaría el importador atado a Windows — este script tiene que poder
 * correr en un cron de Linux el día que se despliegue.
 *
 * Cubre lo que SEPA usa: entradas STORED (0) y DEFLATE (8). Si aparece otro
 * método de compresión, falla explícito en vez de devolver bytes corruptos.
 */
import { open } from "node:fs/promises";
import { inflateRawSync } from "node:zlib";

const FIN_DIRECTORIO = 0x06054b50; // End of Central Directory
const ENTRADA_DIR = 0x02014b50; // Central Directory File Header
const ENTRADA_LOCAL = 0x04034b50; // Local File Header

/**
 * Lista las entradas de un ZIP sin descomprimirlas.
 * Devuelve [{ nombre, offset, tamComprimido, tamReal, metodo }]
 */
async function leerDirectorio(fh, tamArchivo) {
  // El EOCD está al final, después de un comentario de largo variable (máx 64 KB).
  const cola = Math.min(tamArchivo, 65_557);
  const buf = Buffer.alloc(cola);
  await fh.read(buf, 0, cola, tamArchivo - cola);

  let posEocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === FIN_DIRECTORIO) {
      posEocd = i;
      break;
    }
  }
  if (posEocd < 0) throw new Error("ZIP inválido: no se encontró el directorio central");

  const cantidad = buf.readUInt16LE(posEocd + 10);
  const tamDir = buf.readUInt32LE(posEocd + 12);
  const offDir = buf.readUInt32LE(posEocd + 16);

  if (offDir === 0xffffffff || cantidad === 0xffff) {
    throw new Error("ZIP64 no soportado por este lector");
  }

  const dir = Buffer.alloc(tamDir);
  await fh.read(dir, 0, tamDir, offDir);

  const entradas = [];
  let p = 0;
  for (let i = 0; i < cantidad && p < dir.length; i++) {
    if (dir.readUInt32LE(p) !== ENTRADA_DIR) break;

    const metodo = dir.readUInt16LE(p + 10);
    const tamComprimido = dir.readUInt32LE(p + 20);
    const tamReal = dir.readUInt32LE(p + 24);
    const largoNombre = dir.readUInt16LE(p + 28);
    const largoExtra = dir.readUInt16LE(p + 30);
    const largoComentario = dir.readUInt16LE(p + 32);
    const offsetLocal = dir.readUInt32LE(p + 42);
    const nombre = dir.subarray(p + 46, p + 46 + largoNombre).toString("utf8");

    // Las carpetas terminan en "/" y no tienen contenido.
    if (!nombre.endsWith("/")) {
      entradas.push({ nombre, offsetLocal, tamComprimido, tamReal, metodo });
    }
    p += 46 + largoNombre + largoExtra + largoComentario;
  }
  return entradas;
}

/** Extrae UNA entrada y devuelve su contenido como Buffer. */
async function extraerEntrada(fh, entrada) {
  // El header local repite el nombre y el extra, con largos propios: hay que
  // leerlos para saber dónde arrancan los datos.
  const cab = Buffer.alloc(30);
  await fh.read(cab, 0, 30, entrada.offsetLocal);
  if (cab.readUInt32LE(0) !== ENTRADA_LOCAL) {
    throw new Error(`Entrada corrupta: ${entrada.nombre}`);
  }
  const largoNombre = cab.readUInt16LE(26);
  const largoExtra = cab.readUInt16LE(28);
  const inicio = entrada.offsetLocal + 30 + largoNombre + largoExtra;

  const datos = Buffer.alloc(entrada.tamComprimido);
  await fh.read(datos, 0, entrada.tamComprimido, inicio);

  if (entrada.metodo === 0) return datos; // STORED
  if (entrada.metodo === 8) return inflateRawSync(datos); // DEFLATE
  throw new Error(`Método de compresión ${entrada.metodo} no soportado en ${entrada.nombre}`);
}

/**
 * Abre un ZIP y devuelve sus entradas con un lector perezoso.
 * No descomprime nada hasta que se pide cada archivo, así un ZIP de 300 MB no
 * termina entero en memoria.
 */
export async function abrirZip(ruta) {
  const fh = await open(ruta, "r");
  const { size } = await fh.stat();
  const entradas = await leerDirectorio(fh, size);

  return {
    entradas: entradas.map((e) => ({ nombre: e.nombre, tam: e.tamReal })),
    leer: (nombre) => {
      const e = entradas.find((x) => x.nombre === nombre);
      if (!e) throw new Error(`No está en el ZIP: ${nombre}`);
      return extraerEntrada(fh, e);
    },
    cerrar: () => fh.close(),
  };
}

/** Igual que abrirZip pero desde un Buffer en memoria (para los ZIP anidados). */
export async function abrirZipBuffer(buffer) {
  // Se adapta la misma lógica sobre un buffer usando un "file handle" simulado.
  const fh = {
    read: async (buf, off, len, pos) => {
      buffer.copy(buf, off, pos, pos + len);
      return { buffer: buf };
    },
    stat: async () => ({ size: buffer.length }),
    close: async () => {},
  };
  const entradas = await leerDirectorio(fh, buffer.length);
  return {
    entradas: entradas.map((e) => ({ nombre: e.nombre, tam: e.tamReal })),
    leer: (nombre) => {
      const e = entradas.find((x) => x.nombre === nombre);
      if (!e) throw new Error(`No está en el ZIP: ${nombre}`);
      return extraerEntrada(fh, e);
    },
    cerrar: async () => {},
  };
}
