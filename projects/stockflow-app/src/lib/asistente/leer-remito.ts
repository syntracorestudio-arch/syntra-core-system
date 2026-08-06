/**
 * leer-remito.ts — la llamada con visión que transcribe el remito.
 *
 * Solo transcribe. No decide qué producto del catálogo es cada renglón (eso lo
 * hace `ingreso_buscar` del lado del código) ni escribe nada: devuelve líneas
 * crudas que `normalizarLineas` filtra y que el operario confirma después.
 *
 * Falla igual que el resto del asistente: si no hay proveedor, si la API se cae
 * o si vuelve algo con forma rara, se devuelve un error legible y la pantalla de
 * ingreso sigue funcionando a mano como siempre.
 */

import { resolverProveedor, type Proveedor } from "./proveedor.ts";
import { normalizarLineas, type LineaCruda, type LineaRemito } from "./remito.ts";

const VERSION = "2023-06-01";
const TIMEOUT_MS = 45_000; // una foto tarda más que un párrafo de texto
const MAX_TOKENS = 2000;

const SISTEMA = `Transcribís remitos y facturas de proveedores de kioscos argentinos. Te paso la foto de un remito y devolvés SOLO un objeto JSON, sin markdown ni texto alrededor:

{"lineas":[{"texto":"","cantidad":"","costo":""}]}

REGLAS
- Una entrada por RENGLÓN DE PRODUCTO. Ignorá encabezados, datos del proveedor, totales, IVA, subtotales, remito nº, fechas y firmas.
- "texto": el nombre del producto tal cual figura, sin el código interno del proveedor.
- "cantidad": las unidades que entran, solo el número.
- "costo": el precio POR UNIDAD si figura. Si el renglón solo trae el total de la línea, dividilo por la cantidad. Si no hay ningún precio, poné null.
- Si un renglón está borroso o no podés leer la cantidad con seguridad, OMITILO. Una línea de menos la carga el operario a mano; una línea inventada le ensucia el stock sin que se entere.
- No completes ni corrijas nombres con lo que suponés que dice: transcribí lo que ves.`;

export type ResultadoRemito =
  | { ok: true; lineas: LineaRemito[]; modelo: string; tokensIn: number | null; tokensOut: number | null }
  | { ok: false; error: string };

type RespuestaAPI = {
  content?: { type?: string; text?: string }[];
  choices?: { message?: { content?: string } }[];
  usage?: { input_tokens?: number; output_tokens?: number; prompt_tokens?: number; completion_tokens?: number };
};

/** Mismo saneado que el análisis: bloques de razonamiento y cercas de código. */
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

export async function leerRemito(
  imagen: { base64: string; mediaType: string },
  opts: { proveedor?: Proveedor | null; fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<ResultadoRemito> {
  const proveedor = opts.proveedor !== undefined ? opts.proveedor : resolverProveedor(process.env);
  if (!proveedor) {
    return { ok: false, error: "La lectura de remitos no está configurada en este entorno." };
  }

  const doFetch = opts.fetchImpl ?? fetch;
  const ctrl = new AbortController();
  const reloj = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? TIMEOUT_MS);

  try {
    /* Los dos dialectos difieren en cómo viaja la imagen: Anthropic usa un
       bloque `image` con source base64; el compatible con OpenAI usa una data
       URL dentro de `image_url`. Es la única diferencia real. */
    const esAnthropic = proveedor.nombre === "anthropic";
    const headers: Record<string, string> = esAnthropic
      ? { "x-api-key": proveedor.apiKey, "anthropic-version": VERSION, "content-type": "application/json" }
      : { authorization: `Bearer ${proveedor.apiKey}`, "content-type": "application/json" };

    const body = esAnthropic
      ? {
          model: proveedor.modelo,
          max_tokens: MAX_TOKENS,
          system: SISTEMA,
          messages: [
            {
              role: "user",
              content: [
                { type: "image", source: { type: "base64", media_type: imagen.mediaType, data: imagen.base64 } },
                { type: "text", text: "Transcribí los renglones de producto de este remito." },
              ],
            },
          ],
        }
      : {
          model: proveedor.modelo,
          max_tokens: MAX_TOKENS,
          messages: [
            { role: "system", content: SISTEMA },
            {
              role: "user",
              content: [
                { type: "image_url", image_url: { url: `data:${imagen.mediaType};base64,${imagen.base64}` } },
                { type: "text", text: "Transcribí los renglones de producto de este remito." },
              ],
            },
          ],
        };

    const res = await doFetch(proveedor.url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      return {
        ok: false,
        error:
          res.status === 429
            ? "El lector está saturado en este momento. Probá de nuevo en un minuto."
            : "No pudimos leer el remito. Probá de nuevo o cargalo a mano.",
      };
    }

    const datos = (await res.json()) as RespuestaAPI;
    const texto = esAnthropic
      ? datos.content?.find((c) => c.type === "text")?.text
      : datos.choices?.[0]?.message?.content;
    if (!texto) return { ok: false, error: "El lector no devolvió nada. Probá con otra foto." };

    const crudo = parsear(limpiar(texto)) as { lineas?: LineaCruda[] } | null;
    const lineas = normalizarLineas(crudo?.lineas ?? []);
    if (lineas.length === 0) {
      return {
        ok: false,
        error: "No pudimos reconocer renglones en esa foto. Probá que se lean bien los nombres y las cantidades.",
      };
    }

    return {
      ok: true,
      lineas,
      modelo: proveedor.modelo,
      tokensIn: datos.usage?.input_tokens ?? datos.usage?.prompt_tokens ?? null,
      tokensOut: datos.usage?.output_tokens ?? datos.usage?.completion_tokens ?? null,
    };
  } catch (e) {
    return {
      ok: false,
      error:
        (e as Error).name === "AbortError"
          ? "La lectura tardó demasiado. Probá con una foto más liviana."
          : "No pudimos leer el remito. Probá de nuevo o cargalo a mano.",
    };
  } finally {
    clearTimeout(reloj);
  }
}
