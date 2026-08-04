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
import { ANTHROPIC_MODELO, ANTHROPIC_URL, resolverProveedor, type Proveedor } from "./proveedor.ts";
import type { Hechos } from "./hechos.ts";

const VERSION = "2023-06-01";
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
- LARGO MÁXIMO: 600 caracteres. Un párrafo más largo que eso se descarta entero y el dueño no recibe nada. Contá antes de responder.
- Oraciones cortas. Una idea por oración, punto y seguido. Nada de encadenar cláusulas con "lo que", "y que además", "pero también".
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
  /** Anthropic. */
  content?: { type?: string; text?: string }[];
  stop_reason?: string;
  /** OpenAI-compatible. */
  choices?: { message?: { content?: string }; finish_reason?: string }[];
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    prompt_tokens?: number;
    completion_tokens?: number;
  };
};

const fallo = (motivo: string, modelo: string): ResultadoNarrativa => ({
  texto: null,
  estado: "fallida",
  motivo,
  modelo,
  tokensIn: null,
  tokensOut: null,
});

/**
 * Cabeceras y cuerpo en el dialecto del proveedor. Es la ÚNICA diferencia.
 * @param razonamientoCorto segundo intento para modelos que piensan en voz alta.
 */
function pedido(
  p: Proveedor,
  hechos: Hechos,
  razonamientoCorto = false,
): { headers: Record<string, string>; body: string } {
  const datos = JSON.stringify(hechos);
  /* Sin `temperature` en ninguno de los dos: los modelos nuevos de Anthropic la
     rechazan con un 400 y el modelo es configurable por env. El estilo lo fija
     el prompt, no el sampling. */
  if (p.nombre === "anthropic") {
    return {
      headers: { "x-api-key": p.apiKey, "anthropic-version": VERSION, "content-type": "application/json" },
      body: JSON.stringify({
        model: p.modelo,
        max_tokens: MAX_TOKENS,
        system: SISTEMA,
        messages: [{ role: "user", content: datos }],
      }),
    };
  }
  return {
    headers: { authorization: `Bearer ${p.apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: p.modelo,
      max_tokens: MAX_TOKENS,
      /* `reasoning_effort` NO va por defecto: los modelos que no razonan lo
         rechazan con un 400 (verificado contra Groq con llama-3.3-70b y qwen3.6).
         Solo se manda en el reintento, cuando el modelo ya demostró que gasta el
         presupuesto pensando. */
      ...(razonamientoCorto ? { reasoning_effort: "low" } : {}),
      messages: [
        { role: "system", content: SISTEMA },
        { role: "user", content: datos },
      ],
    }),
  };
}

/** Texto, tokens y por qué se cortó, según de qué forma venga la respuesta. */
function leer(
  p: Proveedor,
  datos: RespuestaAPI,
): { texto: string | null; tokensIn: number | null; tokensOut: number | null; corte: string | null } {
  if (p.nombre === "anthropic") {
    return {
      texto: datos.content?.find((c) => c.type === "text")?.text ?? null,
      tokensIn: datos.usage?.input_tokens ?? null,
      tokensOut: datos.usage?.output_tokens ?? null,
      corte: datos.stop_reason ?? null,
    };
  }
  return {
    texto: datos.choices?.[0]?.message?.content ?? null,
    tokensIn: datos.usage?.prompt_tokens ?? null,
    tokensOut: datos.usage?.completion_tokens ?? null,
    corte: datos.choices?.[0]?.finish_reason ?? null,
  };
}

/* Varios modelos abiertos razonan en voz alta antes de contestar y abren con un
   bloque <think>. El verificador lo leería como markup y tiraría un párrafo que
   está bien: se saca acá, y solo si abre el texto. */
function sinRazonamiento(texto: string): string {
  return texto.replace(/^\s*<(think|thinking|reasoning)>[\s\S]*?<\/\1>/i, "").trim();
}

export async function narrarMes(
  reporte: ReporteMensual,
  opts: {
    /** Proveedor explícito; si no se pasa, sale del entorno. */
    proveedor?: Proveedor | null;
    /** Atajo para Anthropic (retrocompatible con las pruebas y el cron). */
    apiKey?: string | null;
    modelo?: string;
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
  } = {},
): Promise<ResultadoNarrativa> {
  const proveedor =
    opts.proveedor !== undefined
      ? opts.proveedor
      : opts.apiKey !== undefined
        ? opts.apiKey
          ? {
              nombre: "anthropic" as const,
              url: ANTHROPIC_URL,
              apiKey: opts.apiKey,
              modelo: opts.modelo ?? process.env.ANTHROPIC_MODEL ?? ANTHROPIC_MODELO,
            }
          : null
        : resolverProveedor(process.env);

  // Sin proveedor configurado el add-on simplemente no está: no es un error.
  if (!proveedor) {
    return { texto: null, estado: "desactivada", motivo: null, modelo: null, tokensIn: null, tokensOut: null };
  }
  const modelo = proveedor.modelo;

  const hechos = hechosDelReporte(reporte);
  const doFetch = opts.fetchImpl ?? fetch;
  const ctrl = new AbortController();
  const reloj = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? TIMEOUT_MS);

  let datos: RespuestaAPI;
  let tokensIn: number | null = null;
  let tokensOut: number | null = null;
  let texto: string | undefined;
  let corte: string | null = null;
  try {
    const pedirYLeer = async (razonamientoCorto: boolean) => {
      const { headers, body } = pedido(proveedor, hechos, razonamientoCorto);
      const res = await doFetch(proveedor.url, { method: "POST", headers, body, signal: ctrl.signal });
      if (!res.ok) return { http: res.status } as const;
      datos = (await res.json()) as RespuestaAPI;
      return { leido: leer(proveedor, datos) } as const;
    };

    let r = await pedirYLeer(false);
    /* Un modelo que razona en voz alta gasta TODO el presupuesto pensando y
       devuelve `content` vacío (verificado contra gpt-oss-120b con el payload
       real). Se le pide una sola vez más con el razonamiento en mínimo — solo a
       los que ya fallaron así, porque los demás rechazan ese campo con un 400. */
    if (proveedor.nombre === "openai-compat" && r.leido && !r.leido.texto && r.leido.corte === "length") {
      r = await pedirYLeer(true);
    }

    if ("http" in r) return fallo(`http_${r.http}`, modelo);
    tokensIn = r.leido.tokensIn;
    tokensOut = r.leido.tokensOut;
    corte = r.leido.corte;
    texto = r.leido.texto ? sinRazonamiento(r.leido.texto) : undefined;
  } catch (e) {
    return fallo((e as Error).message || "error_desconocido", modelo);
  } finally {
    clearTimeout(reloj);
  }

  /* Distinguir "no contestó" de "se quedó sin tokens" importa: lo segundo se
     arregla subiendo MAX_TOKENS o bajando el razonamiento, y un motivo mudo
     manda a buscar el problema al lado equivocado. */
  if (!texto) return fallo(corte === "length" || corte === "max_tokens" ? "sin_texto_por_limite" : "sin_texto", modelo);

  const veredicto = verificarNarrativa(texto, valoresPermitidos(reporte), nombresPermitidos(reporte));
  if (!veredicto.ok) {
    // Se descarta el párrafo ENTERO, no la cifra: un texto con un número
    // corregido a mano sigue siendo un texto en el que no confiamos.
    return { texto: null, estado: "rechazada", motivo: veredicto.motivo, modelo, tokensIn, tokensOut };
  }

  return { texto, estado: "ok", motivo: null, modelo, tokensIn, tokensOut };
}
