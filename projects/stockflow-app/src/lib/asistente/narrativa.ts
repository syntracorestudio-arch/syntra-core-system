/**
 * narrativa.ts — Fase 2 del asistente: el párrafo que lee el mes.
 *
 * Híbrido, no "IA que analiza": los números los calcula el código (composer) y el
 * modelo SOLO los redacta. Recibe hechos cerrados, no tablas ni consultas, y lo
 * que devuelve pasa por `verificarNarrativa` antes de tocar el email.
 *
 * Regla de oro: **el reporte sale igual pase lo que pase**. Sin API key, con la
 * API caída, con timeout o con una cifra inventada, `narrarMes` devuelve
 * `texto: null` y el email se manda con la plantilla determinista de siempre. La
 * narrativa es un extra; el mes del dueño no depende de ella.
 *
 * Sin SDK a propósito: una llamada HTTP no justifica una dependencia nueva.
 */

import type { ReporteMensual } from "./composer.ts";
import { hechosDelReporte, nombresPermitidos, valoresPermitidos, verificarNarrativa } from "./hechos.ts";

const ENDPOINT = "https://api.anthropic.com/v1/messages";
const VERSION = "2023-06-01";
/* Alias sin fecha a propósito: el ID con sufijo (`-20251001`) queda viejo cuando
   sale una versión nueva del mismo modelo. Haiku 4.5 cuesta ~USD 1 el millón de
   tokens de entrada y ~5 el de salida → menos de medio centavo por reporte. */
const MODELO_DEFAULT = "claude-haiku-4-5";
const TIMEOUT_MS = 20_000;
const MAX_TOKENS = 400;

export type EstadoNarrativa = "ok" | "desactivada" | "fallida" | "rechazada";

export type ResultadoNarrativa = {
  texto: string | null;
  estado: EstadoNarrativa;
  motivo: string | null;
  modelo: string | null;
  tokensIn: number | null;
  tokensOut: number | null;
};

const SISTEMA = `Sos el analista de datos de un negocio chico en Argentina (kiosco, dietética, pet shop). Te paso los números YA CALCULADOS del mes que cerró y escribís UN SOLO PÁRRAFO, de 2 a 4 oraciones, que le explique al dueño cómo le fue.

REGLAS DURAS
- Los números que te doy son la única verdad. No calcules, no estimes, no sumes, no saques porcentajes ni proporciones nuevas. Si una cifra no está en los datos, no existe.
- Podés redondear al hablar ("casi 12,5 millones"), nunca cambiar el valor.
- No nombres clientes ni personas: no te los paso, y si te falta un nombre es a propósito.
- Texto plano. Sin markdown, sin negritas, sin links, sin HTML, sin listas, sin títulos.
- Español rioplatense, de vos. Profesional y cercano, como alguien que conoce el rubro.

CÓMO ESCRIBIR
- Conectá: qué pasó este mes y qué conviene mirar primero. No enumeres las oportunidades una por una — el email ya las muestra abajo, cada una con su botón.
- El facturado, la ganancia y la cantidad de ventas ya están impresos arriba de tu párrafo: no los repitas salvo que la comparación entre ellos sea justamente el punto.
- Preferí la causa antes que el dato: "la ganancia bajó más que las ventas porque quedaron precios viejos" vale más que repetir las dos cifras.
- Si el mes fue bueno, decilo sin festejar de más. Si fue malo, decilo sin dramatizar. Nada de felicitaciones, signos de exclamación ni frases hechas.
- Que no parezca escrito por una IA: concreto, sin relleno, sin "en resumen", sin "es importante destacar".`;

type RespuestaAPI = {
  content?: { type?: string; text?: string }[];
  usage?: { input_tokens?: number; output_tokens?: number };
};

const fallo = (motivo: string, modelo: string): ResultadoNarrativa => ({
  texto: null,
  estado: "fallida",
  motivo,
  modelo,
  tokensIn: null,
  tokensOut: null,
});

export async function narrarMes(
  reporte: ReporteMensual,
  opts: {
    apiKey?: string | null;
    modelo?: string;
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
  } = {},
): Promise<ResultadoNarrativa> {
  const apiKey = opts.apiKey === undefined ? process.env.ANTHROPIC_API_KEY : opts.apiKey;
  const modelo = opts.modelo ?? process.env.ANTHROPIC_MODEL ?? MODELO_DEFAULT;

  // Sin key el add-on de narrativa simplemente no está: no es un error.
  if (!apiKey) {
    return { texto: null, estado: "desactivada", motivo: null, modelo: null, tokensIn: null, tokensOut: null };
  }

  const hechos = hechosDelReporte(reporte);
  const doFetch = opts.fetchImpl ?? fetch;
  const ctrl = new AbortController();
  const reloj = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? TIMEOUT_MS);

  let datos: RespuestaAPI;
  let tokensIn: number | null = null;
  let tokensOut: number | null = null;
  try {
    const res = await doFetch(ENDPOINT, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": VERSION,
        "content-type": "application/json",
      },
      /* Sin `temperature`: los modelos nuevos la RECHAZAN con un 400, y el modelo
         es configurable por env (ANTHROPIC_MODEL). Mandarla ataba el reporte al
         modelo de hoy — el estilo lo fija el prompt, no el sampling. */
      body: JSON.stringify({
        model: modelo,
        max_tokens: MAX_TOKENS,
        system: SISTEMA,
        messages: [{ role: "user", content: JSON.stringify(hechos) }],
      }),
      signal: ctrl.signal,
    });

    if (!res.ok) return fallo(`http_${res.status}`, modelo);
    datos = (await res.json()) as RespuestaAPI;
    tokensIn = datos.usage?.input_tokens ?? null;
    tokensOut = datos.usage?.output_tokens ?? null;
  } catch (e) {
    return fallo((e as Error).message || "error_desconocido", modelo);
  } finally {
    clearTimeout(reloj);
  }

  const texto = datos.content?.find((c) => c.type === "text")?.text?.trim();
  if (!texto) return fallo("sin_texto", modelo);

  const veredicto = verificarNarrativa(texto, valoresPermitidos(reporte), nombresPermitidos(reporte));
  if (!veredicto.ok) {
    // Se descarta el párrafo ENTERO, no la cifra: un texto con un número
    // corregido a mano sigue siendo un texto en el que no confiamos.
    return { texto: null, estado: "rechazada", motivo: veredicto.motivo, modelo, tokensIn, tokensOut };
  }

  return { texto, estado: "ok", motivo: null, modelo, tokensIn, tokensOut };
}
