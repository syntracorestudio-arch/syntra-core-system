/**
 * proponer-catalogo.ts — las dos llamadas que ordenan el catálogo.
 *
 * Nombres cortos y categorías, en un solo módulo porque comparten TODO salvo el
 * prompt: la misma llamada de texto (sin visión), el mismo saneado de respuesta,
 * el mismo trato de errores y el mismo verificador del lado del código.
 *
 * Una tanda = una llamada. El costo es por lote, no por producto: 100 nombres
 * salen por menos de un centavo, y el dueño confirma la tanda entera de una.
 */

import { resolverProveedor, type Proveedor } from "./proveedor.ts";
import {
  verificarCategorias,
  verificarNombres,
  type CategoriaDelNegocio,
  type CategoriaVerificada,
  type NombreVerificado,
  type ProductoOriginal,
} from "./catalogo.ts";

const VERSION = "2023-06-01";
const TIMEOUT_MS = 40_000;
const MAX_TOKENS = 4000;

const SISTEMA_NOMBRES = `Acortás nombres de productos de kiosco para que entren en la pantalla del punto de venta. Te paso una lista con id y nombre largo (vienen de un catálogo mayorista y son ilegibles) y devolvés SOLO este JSON:

{"nombres":[{"id":"","nombre":""}]}

REGLAS
- CONSERVÁ SIEMPRE: la marca y el tamaño con su unidad. "GASEOSA COCA COLA SABOR ORIGINAL BOTELLA 2.25 LT" → "Coca Cola 2.25L".
- Conservá también la variante si la hay (light, zero, sabor): distingue productos que el dueño vende por separado.
- Sacá lo que no distingue nada: el tipo genérico al principio ("GASEOSA", "GALLETITAS"), palabras como BOTELLA, PAQUETE, UNIDAD, y el código del proveedor.
- Máximo 40 caracteres. Capitalización normal, no TODO EN MAYÚSCULAS.
- Si un nombre ya es corto y claro, OMITILO de la respuesta: no hay nada que arreglar.
- Nunca dos productos con el mismo nombre final.`;

const SISTEMA_CATEGORIAS = `Clasificás productos de kiosco en las categorías que YA tiene el negocio. Te paso las categorías disponibles y una lista de productos con id y nombre. Devolvés SOLO este JSON:

{"categorias":[{"id":"","categoria":""}]}

REGLAS
- "categoria" tiene que ser EXACTAMENTE una de las categorías que te paso. No inventes ninguna nueva ni uses sinónimos.
- Si un producto no encaja claramente en ninguna, OMITILO. Es preferible dejarlo sin categoría a meterlo en la equivocada: el dueño lo va a buscar donde lo puso él.`;

export type ResultadoNombres = { ok: true; nombres: NombreVerificado[] } | { ok: false; error: string };
export type ResultadoCategorias = { ok: true; categorias: CategoriaVerificada[] } | { ok: false; error: string };

type RespuestaAPI = {
  content?: { type?: string; text?: string }[];
  choices?: { message?: { content?: string } }[];
};

function limpiar(t: string): string {
  return t
    .replace(/^\s*<(think|thinking|reasoning)>[\s\S]*?<\/\1>/i, "")
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();
}

function parsear(t: string): unknown {
  try {
    return JSON.parse(t);
  } catch {
    const a = t.indexOf("{");
    const b = t.lastIndexOf("}");
    if (a < 0 || b <= a) return null;
    try {
      return JSON.parse(t.slice(a, b + 1));
    } catch {
      return null;
    }
  }
}

/** La llamada, en el dialecto del proveedor. Devuelve el texto crudo o null. */
async function pedir(
  sistema: string,
  usuario: string,
  opts: { proveedor?: Proveedor | null; fetchImpl?: typeof fetch; timeoutMs?: number },
): Promise<{ ok: true; texto: string } | { ok: false; error: string }> {
  const proveedor = opts.proveedor !== undefined ? opts.proveedor : resolverProveedor(process.env);
  if (!proveedor) return { ok: false, error: "El asistente no está configurado en este entorno." };

  const doFetch = opts.fetchImpl ?? fetch;
  const ctrl = new AbortController();
  const reloj = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? TIMEOUT_MS);
  try {
    const esAnthropic = proveedor.nombre === "anthropic";
    const headers: Record<string, string> = esAnthropic
      ? { "x-api-key": proveedor.apiKey, "anthropic-version": VERSION, "content-type": "application/json" }
      : { authorization: `Bearer ${proveedor.apiKey}`, "content-type": "application/json" };
    const body = esAnthropic
      ? { model: proveedor.modelo, max_tokens: MAX_TOKENS, system: sistema, messages: [{ role: "user", content: usuario }] }
      : {
          model: proveedor.modelo,
          max_tokens: MAX_TOKENS,
          messages: [
            { role: "system", content: sistema },
            { role: "user", content: usuario },
          ],
        };

    const res = await doFetch(proveedor.url, { method: "POST", headers, body: JSON.stringify(body), signal: ctrl.signal });
    if (!res.ok) {
      return {
        ok: false,
        error:
          res.status === 429
            ? "El asistente está saturado. Probá de nuevo en un minuto."
            : "No pudimos generar las sugerencias. Probá de nuevo.",
      };
    }
    const datos = (await res.json()) as RespuestaAPI;
    const texto = esAnthropic
      ? datos.content?.find((c) => c.type === "text")?.text
      : datos.choices?.[0]?.message?.content;
    if (!texto) return { ok: false, error: "El asistente no devolvió nada. Probá de nuevo." };
    return { ok: true, texto: limpiar(texto) };
  } catch (e) {
    return {
      ok: false,
      error:
        (e as Error).name === "AbortError"
          ? "La sugerencia tardó demasiado. Probá con menos productos."
          : "No pudimos generar las sugerencias. Probá de nuevo.",
    };
  } finally {
    clearTimeout(reloj);
  }
}

export async function proponerNombres(
  productos: ProductoOriginal[],
  existentes: string[],
  opts: { proveedor?: Proveedor | null; fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<ResultadoNombres> {
  if (productos.length === 0) return { ok: true, nombres: [] };

  const r = await pedir(SISTEMA_NOMBRES, JSON.stringify({ productos }), opts);
  if (!r.ok) return r;

  const crudo = parsear(r.texto) as { nombres?: { id: string; nombre: string }[] } | null;
  const nombres = verificarNombres(crudo?.nombres ?? [], productos, existentes);
  if (nombres.length === 0) {
    return { ok: false, error: "No salió ninguna sugerencia usable para estos productos." };
  }
  return { ok: true, nombres };
}

export async function proponerCategorias(
  productos: ProductoOriginal[],
  categorias: CategoriaDelNegocio[],
  opts: { proveedor?: Proveedor | null; fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<ResultadoCategorias> {
  if (productos.length === 0) return { ok: true, categorias: [] };
  if (categorias.length === 0) {
    return { ok: false, error: "Todavía no tenés categorías creadas. Creá una y volvé." };
  }

  const usuario = JSON.stringify({ categorias: categorias.map((c) => c.name), productos });
  const r = await pedir(SISTEMA_CATEGORIAS, usuario, opts);
  if (!r.ok) return r;

  const crudo = parsear(r.texto) as { categorias?: { id: string; categoria: string }[] } | null;
  const verificadas = verificarCategorias(crudo?.categorias ?? [], productos, categorias);
  if (verificadas.length === 0) {
    return { ok: false, error: "El asistente no pudo ubicar estos productos en tus categorías." };
  }
  return { ok: true, categorias: verificadas };
}
