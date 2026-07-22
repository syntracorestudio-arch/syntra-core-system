/**
 * Normalizador de descripciones de producto del dataset SEPA.
 *
 * SEPA (datos.produccion.gob.ar, CC-BY 4.0) publica lo que las cadenas cargan en
 * sus sistemas de góndola: abreviado, en mayúsculas, con sufijos técnicos de
 * packaging y sin criterio uniforme entre cadenas. Tal cual viene, mostrárselo a
 * un kiosquero sería peor que dejarlo escribir el nombre a mano.
 *
 * Ejemplos reales del dataset:
 *   "gaseosa COCA COLA Regular 1lt BOT-1000-ml."  → "Coca Cola Regular 1 L"
 *   "PAPEL HIGIENICO ELITE CLASICO H.S.6"          → "Papel Higiénico Elite Clásico"
 *   "lavandina AYUDIN original 1L PVC-1000-ml."    → "Lavandina Ayudín Original 1 L"
 *
 * Es un módulo aparte y con tests porque es la pieza de la que depende que el
 * catálogo se sienta profesional o cutre.
 */

/** Sufijos técnicos de packaging que las cadenas anexan y no significan nada
 *  para el que vende: BOT-1000-ml., PAQ-100-gr., CJA-25-un., PVC-2000-ml. */
const SUFIJO_PACKAGING =
  /\b(BOT|PAQ|CJA|PVC|LAT|SOB|EST|FCO|DOY|POT|BSA|BID|TET|PZA|BLI|TBO|ROL|UNI)[-\s]?\d*[-\s]?(ml|gr|kg|lt|l|cc|un|mt|m)?\.?\s*$/gi;

/** Ruido de góndola: códigos internos y marcas de control de las cadenas. */
const RUIDO = [
  /\bH\.S\.\d+\b/gi, // "H.S.6" (hojas simples x6)
  /\bx?\s*\d+\s*un[ i]?\.?\s*$/gi, // "1 uni." al final
  /^\*+/, // asteriscos de apertura
  /\s*\([TA]\)\s*$/i, // "(T)" / "(A)" marcas internas
  /\bS\/D\b/gi, // "sin dato"
];

/** Acentos que las cadenas comen. Se reponen solo en palabras inequívocas. */
const ACENTOS = new Map(
  Object.entries({
    higienico: "higiénico", clasico: "clásico", limon: "limón",
    azucar: "azúcar", cafe: "café", te: "té", almibar: "almíbar",
    jamon: "jamón", champu: "champú", jabon: "jabón", algodon: "algodón",
    aceitunas: "aceitunas", mani: "maní", pure: "puré", articulo: "artículo",
    liquido: "líquido", organico: "orgánico", automatico: "automático",
    plastico: "plástico", electrico: "eléctrico", cascara: "cáscara",
    bebe: "bebé", panal: "pañal", panales: "pañales", anos: "años",
    ninos: "niños", pina: "piña", banana: "banana", durazno: "durazno",
    yogur: "yogur", light: "light", diet: "diet",
    maiz: "maíz", limpiaviricos: "limpiavidrios", pañuelos: "pañuelos",
    jugo: "jugo", almibar2: "almíbar", cafeina: "cafeína", tonico: "tónico",
    comun: "común", monodosis: "monodosis", frances: "francés",
    ingles: "inglés", vainilla: "vainilla", chocolate: "chocolate",
  }),
);

/** Material de envase: no le dice nada al que vende. */
const MATERIAL_ENVASE = /\b(PET|PVC|LATA|VIDRIO|TETRA|DOYPACK|CARTON|PLAST)\b\.?/gi;

/** Palabras que deben quedar en MAYÚSCULA aunque el resto vaya en Title Case. */
const SIGLAS = new Set(["ML", "GR", "KG", "LT", "L", "CC", "UN", "TV", "LED", "USB", "XL", "XXL"]);

/**
 * Repara mojibake típico de leer Latin-1 como UTF-8 (o al revés).
 * En SEPA hay archivos con distinto encoding según la cadena, y el resultado son
 * "Jam�n" o "HERM TICOS". Esto atrapa los casos recuperables; los que ya
 * perdieron el byte se marcan para no publicarlos.
 */
export function repararEncoding(texto) {
  const reemplazos = {
    "Ã¡": "á", "Ã©": "é", "Ã­": "í", "Ã³": "ó", "Ãº": "ú",
    "Ã±": "ñ", "Ã": "Á", "Ã‰": "É", "Ã": "Í", "Ã“": "Ó",
    "Ãš": "Ú", "Ã‘": "Ñ", "Âº": "º", "Â°": "°", "Â": "",
  };
  let out = texto;
  for (const [malo, bueno] of Object.entries(reemplazos)) {
    out = out.split(malo).join(bueno);
  }
  return out;
}

/** ¿Perdió bytes de forma irrecuperable? Entonces no se publica. */
export function tieneEncodingRoto(texto) {
  return /�/.test(texto) || /\b[A-ZÁÉÍÓÚ]{2,}\s[A-Z]{4,}\b/.test(texto) === false && false;
}

/** Normaliza unidades: "1lt" → "1 L", "500GR" → "500 g", "2000-ml" → "2 L". */
function normalizarUnidades(texto) {
  return texto
    .replace(/(\d+(?:[.,]\d+)?)\s*-?\s*(ml|mL|ML)\b/g, (_, n) => {
      const v = parseFloat(String(n).replace(",", "."));
      return v >= 1000 ? `${v / 1000} L` : `${v} ml`;
    })
    .replace(/(\d+(?:[.,]\d+)?)\s*-?\s*(gr?s?|GR?S?)\b/g, (_, n) => {
      const v = parseFloat(String(n).replace(",", "."));
      return v >= 1000 ? `${v / 1000} kg` : `${v} g`;
    })
    .replace(/(\d+(?:[.,]\d+)?)\s*-?\s*(lt?s?|LT?S?)\b/g, "$1 L")
    .replace(/(\d+(?:[.,]\d+)?)\s*-?\s*(kgs?|KGS?)\b/g, "$1 kg")
    .replace(/\s*x\s*(\d+)\s*$/i, " x$1");
}

/** Title Case respetando siglas, unidades y palabras cortas. */
function titleCase(texto) {
  const menores = new Set(["de", "del", "la", "el", "con", "sin", "y", "para", "por", "a", "en"]);
  return texto
    .split(/\s+/)
    .map((palabra, i) => {
      const limpia = palabra.replace(/[.,]$/, "");
      if (SIGLAS.has(limpia.toUpperCase()) && /^[a-zA-Z]+$/.test(limpia)) {
        return limpia.toUpperCase() === "L" ? "L" : limpia.toLowerCase();
      }
      if (/\d/.test(palabra)) return palabra; // "500", "1.5", "x6"
      const baja = palabra.toLowerCase();
      if (i > 0 && menores.has(baja)) return baja;
      const acentuada = ACENTOS.get(baja) ?? baja;
      return acentuada.charAt(0).toUpperCase() + acentuada.slice(1);
    })
    .join(" ");
}

/**
 * Convierte una descripción cruda de SEPA en un nombre presentable.
 * Devuelve null si el resultado no es publicable (encoding perdido o muy corto).
 */
export function normalizarDescripcion(cruda) {
  if (!cruda || typeof cruda !== "string") return null;

  let t = repararEncoding(cruda);

  // Los bytes perdidos ya no se recuperan: mejor no mostrar nada que mostrar basura.
  if (t.includes("�")) return null;

  t = t.replace(SUFIJO_PACKAGING, " ");
  t = t.replace(MATERIAL_ENVASE, " ");
  for (const r of RUIDO) t = t.replace(r, " ");
  t = t.replace(/[_]+/g, " ").replace(/\s{2,}/g, " ").trim();
  t = normalizarUnidades(t);
  t = titleCase(t);
  // La "x" de cantidad va en minúscula: "X 900 cc" se lee como parte del nombre.
  t = t.replace(/\bX\b(?=\s*\d)/g, "x");
  // Las unidades van como se escriben de verdad: "69 g", no "69 G". El Title Case
  // las capitaliza sin querer y queda con aire de planilla.
  t = t.replace(/(\d)\s*(G|Gr|Kg|KG|Ml|ML|Cc|CC|L|Lt|Mt)\b\.?/g, (_, n, u) => {
    const mapa = { g: "g", gr: "g", kg: "kg", ml: "ml", cc: "cc", l: "L", lt: "L", mt: "m" };
    return `${n} ${mapa[u.toLowerCase()] ?? u.toLowerCase()}`;
  });
  // Las comas de las cadenas separan campos, no son parte del nombre.
  t = t.replace(/\s*,\s*/g, " ");
  t = t.replace(/\s{2,}/g, " ").replace(/[.,\s]+$/, "").trim();

  if (t.length < 4) return null;

  // La marca suele venir repetida dentro de la descripción; si no está, no se
  // fuerza: en SEPA la marca a veces es el fabricante y no lo que dice el envase
  // (vimos "ALFAJOR AGUILA" con marca "CANDY MIX").
  return t;
}

/** Marca publicable, o null. */
export function normalizarMarca(marca) {
  if (!marca) return null;
  const m = repararEncoding(String(marca)).trim();
  if (!m || /^(S\/D|SIN MARCA|GENERICO|VARIOS)$/i.test(m)) return null;
  if (m.includes("�")) return null;
  return titleCase(m);
}
