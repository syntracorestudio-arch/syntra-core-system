/**
 * Lectura de planillas para el import de catálogo.
 *
 * Todo acá es lógica pura, sin navegador ni base: es la parte donde un error
 * silencioso se paga carísimo (cargar toda la góndola a un peso) y por eso tiene
 * que poder probarse sola. Ver csv-import.test.ts.
 *
 * La regla que ordena el diseño: **el archivo no se adivina, se muestra.** Todo
 * lo de acá produce SUGERENCIAS que la persona confirma en una vista previa. Por
 * eso preferimos equivocarnos avisando antes que acertar en silencio.
 */

/** Campos que el import sabe cargar. `ignorar` = la columna no se usa. */
export type Campo = "nombre" | "precio" | "costo" | "codigo" | "stock" | "ignorar";

export type FilaCruda = string[];

/* -------------------------------------------------------------------------
 * 1 · Texto
 * ------------------------------------------------------------------------- */

/**
 * Las planillas de kiosco vienen tanto en UTF-8 como en el Latin-1 que deja
 * Excel viejo en Windows. Si decodificamos mal, los nombres llegan con "Ã±" y el
 * catálogo nace roto.
 *
 * No hay forma 100% confiable de detectarlo, pero sí una señal clara: el
 * carácter de reemplazo (U+FFFD) aparece cuando UTF-8 no pudo con un byte.
 */
export function decodificar(buffer: ArrayBuffer): string {
  const utf8 = new TextDecoder("utf-8").decode(buffer);
  if (!utf8.includes("�")) return utf8.replace(/^﻿/, "");
  return new TextDecoder("windows-1252").decode(buffer).replace(/^﻿/, "");
}

/**
 * Separador: coma, punto y coma o tabulación.
 *
 * En Argentina el Excel en español guarda CSV con punto y coma, justamente
 * porque la coma es el separador decimal. Se elige el que parte las primeras
 * líneas en la mayor cantidad de columnas de forma CONSISTENTE — contar
 * apariciones sueltas se equivoca en cuanto un nombre trae una coma.
 */
export function detectarSeparador(texto: string): string {
  const lineas = texto.split(/\r?\n/).filter((l) => l.trim() !== "").slice(0, 20);
  if (lineas.length === 0) return ",";

  let mejor = ",";
  let mejorPuntaje = -1;
  for (const sep of [";", ",", "\t", "|"]) {
    const cuentas = lineas.map((l) => partirLinea(l, sep).length);
    const max = Math.max(...cuentas);
    if (max < 2) continue;
    // Consistencia: cuántas líneas tienen la cantidad de columnas más común.
    const moda = cuentas.sort(
      (a, b) => cuentas.filter((c) => c === b).length - cuentas.filter((c) => c === a).length,
    )[0];
    const consistentes = cuentas.filter((c) => c === moda).length;
    const puntaje = moda * 10 + consistentes;
    if (moda >= 2 && puntaje > mejorPuntaje) {
      mejorPuntaje = puntaje;
      mejor = sep;
    }
  }
  return mejor;
}

/** Parte una línea respetando comillas (y comillas dobladas dentro del campo). */
function partirLinea(linea: string, sep: string): string[] {
  const campos: string[] = [];
  let actual = "";
  let entreComillas = false;
  for (let i = 0; i < linea.length; i++) {
    const c = linea[i];
    if (c === '"') {
      if (entreComillas && linea[i + 1] === '"') {
        actual += '"';
        i++;
      } else {
        entreComillas = !entreComillas;
      }
    } else if (c === sep && !entreComillas) {
      campos.push(actual.trim());
      actual = "";
    } else {
      actual += c;
    }
  }
  campos.push(actual.trim());
  return campos;
}

/**
 * Texto completo → filas.
 *
 * Las filas vacías se CONSERVAN a propósito: son separadoras y no aportan nada,
 * pero sacarlas correría la numeración, y entonces el resumen diría "revisá la
 * fila 7" señalando algo que en Excel es la 9. Se ignoran al armar.
 */
export function parsearFilas(texto: string, separador?: string): FilaCruda[] {
  const sep = separador ?? detectarSeparador(texto);
  return texto.split(/\r?\n/).map((l) => partirLinea(l, sep));
}

/* -------------------------------------------------------------------------
 * 2 · Encabezado y mapeo
 * ------------------------------------------------------------------------- */

const PALABRAS: { campo: Exclude<Campo, "ignorar">; claves: string[] }[] = [
  { campo: "nombre", claves: ["descripcion", "detalle", "producto", "articulo", "nombre", "item"] },
  { campo: "costo", claves: ["costo", "p costo", "precio costo", "compra", "neto"] },
  { campo: "precio", claves: ["precio", "pvp", "p v p", "venta", "publico", "lista", "sugerido"] },
  { campo: "codigo", claves: ["codigo", "cod", "ean", "barras", "c barras", "sku", "upc"] },
  { campo: "stock", claves: ["stock", "cantidad", "cant", "existencia", "unidades", "stk"] },
];

function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** ¿Cuántas celdas de esta fila parecen nombres de columna conocidos? */
function puntajeEncabezado(fila: FilaCruda): number {
  let n = 0;
  for (const celda of fila) {
    const t = normalizar(celda);
    if (t === "") continue;
    if (PALABRAS.some((p) => p.claves.some((k) => t === k || t.includes(k)))) n++;
  }
  return n;
}

/**
 * Fila del encabezado: la primera con al menos DOS nombres de columna conocidos.
 *
 * Las planillas reales arrancan con título, fecha de vigencia y una fila vacía,
 * a veces con celdas combinadas. Si no encontramos nada, devolvemos -1 y **la
 * elige la persona en la vista previa** — antes que asumir la fila 0 y desplazar
 * todo el archivo en silencio.
 */
export function detectarFilaEncabezado(filas: FilaCruda[]): number {
  for (let i = 0; i < Math.min(filas.length, 15); i++) {
    if (puntajeEncabezado(filas[i]) >= 2) return i;
  }
  return -1;
}

/** Sugerencia de mapeo por nombre de columna. Siempre confirmable a mano. */
export function sugerirMapeo(encabezado: FilaCruda): Campo[] {
  const usados = new Set<Campo>();
  return encabezado.map((celda) => {
    const t = normalizar(celda);
    if (t === "") return "ignorar";
    // Exacto primero: "precio costo" no debe ganar como "precio".
    for (const { campo, claves } of PALABRAS) {
      if (usados.has(campo)) continue;
      if (claves.some((k) => t === k)) {
        usados.add(campo);
        return campo;
      }
    }
    for (const { campo, claves } of PALABRAS) {
      if (usados.has(campo)) continue;
      if (claves.some((k) => t.includes(k))) {
        usados.add(campo);
        return campo;
      }
    }
    return "ignorar";
  });
}

/* -------------------------------------------------------------------------
 * 3 · Números — la parte peligrosa
 * ------------------------------------------------------------------------- */

/**
 * Decide cómo leer los números de UNA columna, mirando la columna entera.
 *
 * Es la decisión más peligrosa del import: en Argentina `1.250` son mil
 * doscientos cincuenta, no uno con veinticinco. Un lector ingenuo carga toda la
 * góndola a un peso y el kiosco vende a pérdida hasta que alguien lo note.
 *
 * Por eso se decide por COLUMNA y no por celda: dentro de una misma lista de
 * precios el formato es siempre el mismo, y una celda suelta no alcanza para
 * distinguir "1.250" (miles) de "1.25" (decimal).
 */
export function detectarFormatoNumerico(valores: string[]): "coma-decimal" | "punto-decimal" {
  let comaDecimal = 0;
  let puntoMiles = 0;
  let puntoDecimal = 0;

  for (const v of valores) {
    const t = v.replace(/[^\d.,]/g, "");
    if (t === "") continue;
    if (/,\d{1,2}$/.test(t)) comaDecimal++;
    if (/^\d{1,3}(\.\d{3})+$/.test(t)) puntoMiles++;
    else if (/\.\d{1,2}$/.test(t)) puntoDecimal++;
  }

  // Cualquier señal de formato argentino manda: es el caso local y el más caro
  // de equivocar.
  if (comaDecimal > 0 || puntoMiles > 0) return "coma-decimal";
  if (puntoDecimal > 0) return "punto-decimal";
  return "coma-decimal";
}

/** Un valor a número, según el formato ya decidido para su columna. */
export function leerNumero(
  valor: string,
  formato: "coma-decimal" | "punto-decimal",
): number | null {
  const t = valor.replace(/[^\d.,-]/g, "").trim();
  if (t === "" || t === "-") return null;

  const limpio =
    formato === "coma-decimal"
      ? t.replace(/\./g, "").replace(",", ".")
      : t.replace(/,/g, "");

  const n = Number(limpio);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

/* -------------------------------------------------------------------------
 * 4 · Códigos de barras
 * ------------------------------------------------------------------------- */

/**
 * Normaliza un código. `null` = no se puede recuperar.
 *
 * Excel es el gran enemigo acá: guarda los códigos como número y devuelve
 * `7.79E+12`, con lo que los últimos dígitos se perdieron para siempre. Ese
 * código NO se puede reconstruir, así que el producto entra SIN código (sigue
 * siendo vendible) y se cuenta aparte para poder decirlo en el resumen. Después
 * se le pega escaneando, que es el flujo de "¿no será este que ya tenés?".
 */
export function normalizarCodigo(valor: string): { codigo: string | null; roto: boolean } {
  const t = valor.trim();
  if (t === "") return { codigo: null, roto: false };

  if (/e\+?\d+$/i.test(t.replace(/\s/g, ""))) return { codigo: null, roto: true };

  const soloDigitos = t.replace(/[\s-]/g, "");
  if (!/^\d+$/.test(soloDigitos)) return { codigo: null, roto: true };
  // EAN-8 a GTIN-14. Más corto es un código interno del proveedor, que no sirve
  // para escanear en la góndola; más largo no existe.
  if (soloDigitos.length < 8 || soloDigitos.length > 14) return { codigo: null, roto: true };

  return { codigo: soloDigitos, roto: false };
}

/* -------------------------------------------------------------------------
 * 5 · Armado final
 * ------------------------------------------------------------------------- */

export type ProductoImportado = {
  nombre: string;
  precio: number | null;
  costo: number | null;
  codigo: string | null;
  stock: number | null;
  /** El código venía pero Excel lo arruinó: el producto entra sin código. */
  codigoIlegible: boolean;
};

export type Rechazo = { fila: number; motivo: string; contenido: string };

export type Resultado = {
  productos: ProductoImportado[];
  rechazos: Rechazo[];
  /** Códigos repetidos DENTRO del archivo: gana el primero. */
  codigosDuplicados: number;
};

/** Tope duro de lectura: una planilla de kiosco no tiene 5000 filas. */
export const MAX_FILAS = 5000;

export function armar(
  filas: FilaCruda[],
  encabezadoEn: number,
  mapeo: Campo[],
): Resultado {
  const cuerpo = filas.slice(encabezadoEn + 1, encabezadoEn + 1 + MAX_FILAS);
  const col = (campo: Campo) => mapeo.indexOf(campo);

  const iNombre = col("nombre");
  const iPrecio = col("precio");
  const iCosto = col("costo");
  const iCodigo = col("codigo");
  const iStock = col("stock");

  // El formato numérico se decide UNA vez por columna, con la columna entera.
  const columna = (i: number) => (i < 0 ? [] : cuerpo.map((f) => f[i] ?? ""));
  const fmtPrecio = detectarFormatoNumerico(columna(iPrecio));
  const fmtCosto = detectarFormatoNumerico(columna(iCosto));
  const fmtStock = detectarFormatoNumerico(columna(iStock));

  const productos: ProductoImportado[] = [];
  const rechazos: Rechazo[] = [];
  const vistos = new Set<string>();
  let codigosDuplicados = 0;

  cuerpo.forEach((f, idx) => {
    const nroFila = encabezadoEn + 2 + idx; // 1-based, como lo ve la persona en Excel
    const nombre = (iNombre >= 0 ? (f[iNombre] ?? "") : "").trim();

    // Fila separadora: no es un rechazo, no existe.
    if (f.every((c) => c.trim() === "")) return;

    /* Filas de cierre ("TOTAL", "SUBTOTAL"). Se busca en la PRIMERA celda con
       contenido, no en la del nombre: en las listas reales el total queda
       escrito en la columna del código o en la primera que haya. */
    const primera = f.find((c) => c.trim() !== "") ?? "";
    if (/^(total|subtotal|suma|totales)\b/i.test(primera.trim())) {
      rechazos.push({ fila: nroFila, motivo: "fila de total", contenido: f.join(" · ") });
      return;
    }

    if (nombre.length < 2) {
      rechazos.push({ fila: nroFila, motivo: "sin nombre", contenido: f.join(" · ") });
      return;
    }

    const precio = iPrecio >= 0 ? leerNumero(f[iPrecio] ?? "", fmtPrecio) : null;
    const costo = iCosto >= 0 ? leerNumero(f[iCosto] ?? "", fmtCosto) : null;
    const stock = iStock >= 0 ? leerNumero(f[iStock] ?? "", fmtStock) : null;
    const { codigo, roto } = iCodigo >= 0 ? normalizarCodigo(f[iCodigo] ?? "") : { codigo: null, roto: false };

    if (precio === null && costo === null && codigo === null) {
      rechazos.push({ fila: nroFila, motivo: "sin precio, costo ni código", contenido: f.join(" · ") });
      return;
    }

    if (codigo !== null) {
      if (vistos.has(codigo)) {
        codigosDuplicados++;
        productos.push({ nombre, precio, costo, codigo: null, stock, codigoIlegible: false });
        return;
      }
      vistos.add(codigo);
    }

    productos.push({ nombre, precio, costo, codigo, stock, codigoIlegible: roto });
  });

  return { productos, rechazos, codigosDuplicados };
}
