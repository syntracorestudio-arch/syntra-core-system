/**
 * remito.ts — leer la foto del remito del proveedor y proponer el ingreso.
 *
 * Es el primer lugar donde el modelo no describe: PROPONE ESCRITURAS sobre el
 * stock y los costos del negocio. La filosofía es la misma del verificador de
 * cifras, aplicada a la escritura:
 *
 *     el modelo PROPONE · el código VALIDA · el operario CONFIRMA
 *
 * Concretamente: el modelo solo devuelve texto y números crudos de cada renglón.
 * NO elige el producto — eso lo hace la búsqueda del catálogo que ya existe
 * (`ingreso_buscar`), porque si el modelo eligiera, un nombre parecido terminaría
 * sumándole stock al producto equivocado y nadie lo auditaría. Y nada se guarda:
 * lo que sale de acá precarga el carrito de "Recibir mercadería", donde el
 * operario revisa línea por línea y confirma con el flujo de siempre.
 */

export type LineaCruda = { texto: string; cantidad: string | number | null; costo: string | number | null };

export type LineaRemito = {
  /** Lo que dice el renglón: con esto se busca en el catálogo del negocio. */
  texto: string;
  cantidad: number;
  /** Costo unitario. Puede faltar: muchos remitos traen solo el total. */
  costoUnitario: number | null;
};

/* Un remito de kiosco tiene 10-40 renglones. Más que esto es un OCR delirando o
   un catálogo entero: ni entra en la pantalla ni conviene pagarlo. */
const MAX_LINEAS = 60;
/* Nadie recibe 5.000 unidades de un producto en un kiosco. Un número así es un
   OCR que se comió un separador, y entraría al stock sin que nadie lo note. */
const MAX_CANTIDAD = 5_000;

const MEDIA_SOPORTADOS = ["image/jpeg", "image/png", "image/webp"] as const;
/* La API acepta más, pero una foto de celular arriba de esto es casi siempre un
   error de encuadre — y se cobra igual. Se corta antes de gastar la llamada. */
const MAX_BYTES = 5 * 1024 * 1024;

/** "$1.450,50" → 1450.5 · "12 u" → 12 · basura → null. */
function aNumero(v: string | number | null | undefined): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const s = v
    .replace(/[^\d.,-]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");
  if (s === "" || s === "-") return null;
  const x = Number(s);
  return Number.isFinite(x) ? x : null;
}

/**
 * Convierte lo que devolvió el modelo en líneas usables. Todo lo que no se puede
 * afirmar se descarta: es preferible que el operario cargue tres renglones a mano
 * a que uno entre con una cantidad inventada.
 */
export function normalizarLineas(crudas: LineaCruda[]): LineaRemito[] {
  if (!Array.isArray(crudas)) return [];

  const lineas: LineaRemito[] = [];
  for (const c of crudas) {
    if (!c || typeof c !== "object") continue;

    const texto = typeof c.texto === "string" ? c.texto.trim() : "";
    if (texto === "" || texto.length > 120) continue;

    // Sin cantidad no hay ingreso: es el único campo que no se puede suponer.
    const cantidad = aNumero(c.cantidad);
    if (cantidad === null || cantidad <= 0 || cantidad > MAX_CANTIDAD) continue;

    const costo = aNumero(c.costo);
    lineas.push({
      texto,
      cantidad,
      costoUnitario: costo !== null && costo > 0 ? costo : null,
    });
    if (lineas.length >= MAX_LINEAS) break;
  }
  return lineas;
}

export type ImagenLista =
  | { ok: true; base64: string; mediaType: (typeof MEDIA_SOPORTADOS)[number] }
  | { ok: false; error: string };

/** Valida y codifica la foto ANTES de gastar una llamada al modelo. */
export async function prepararImagen(file: File): Promise<ImagenLista> {
  const tipo = MEDIA_SOPORTADOS.find((m) => m === file.type);
  if (!tipo) {
    return { ok: false, error: "Subí una foto del remito (JPG, PNG o WEBP)." };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: "La foto es muy pesada. Sacala de nuevo con menos calidad." };
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binario = "";
  for (let i = 0; i < bytes.length; i += 8192) {
    binario += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return { ok: true, base64: btoa(binario), mediaType: tipo };
}
