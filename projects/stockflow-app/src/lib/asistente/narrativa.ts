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
import { hechosDelReporte, verdadDelReporte, type Crudos } from "./hechos.ts";
import { verificarAnalisis, type Analisis } from "./analisis.ts";
import { ANTHROPIC_MODELO, ANTHROPIC_URL, resolverProveedor, type Proveedor } from "./proveedor.ts";
import type { Hechos } from "./hechos.ts";
import type { Mercado } from "./mercado.ts";

const VERSION = "2023-06-01";
const TIMEOUT_MS = 20_000;
const MAX_TOKENS = 1200; // el JSON del análisis con 4 acciones no entra en menos

export type EstadoNarrativa = "ok" | "desactivada" | "fallida" | "rechazada";

export type ResultadoNarrativa = {
  analisis: Analisis | null;
  estado: EstadoNarrativa;
  motivo: string | null;
  modelo: string | null;
  tokensIn: number | null;
  tokensOut: number | null;
};

const SISTEMA = `Sos analista de negocios chicos en Argentina (kiosco, dietética, pet shop). Te paso los números YA CALCULADOS del mes que cerró.

Tu trabajo NO es resumirlos: el dueño ya los tiene impresos arriba de tu texto. Tu trabajo es DIAGNOSTICAR dónde se le está yendo la plata y decirle qué hacer esta semana. Si lo único que decís es lo que ya está en pantalla, no servís para nada.

Respondés SOLO un objeto JSON. Sin markdown, sin bloques de código, sin una palabra antes ni después:

{"dolor":{"titulo":"","porque":""},"acciones":[{"tipo":"remarcar|stock_muerto|fiado|datos","texto":"","producto":null,"monto":null}],"fuga":null,"huecos":null}

QUÉ VA EN CADA CAMPO
- dolor.titulo: el problema más caro del mes, en menos de 90 caracteres. SIN NÚMEROS: los números van en "porque" y en las acciones. Un número en el título descarta el análisis entero.
- dolor.porque: LA CAUSA. Conectá dos hechos que en los datos vienen separados. Acá está todo el valor: "no es que vendas poco, es que vendés mucho de lo que peor te paga" vale más que cualquier cifra repetida.
- acciones: entre 2 y 4, ejecutables esta semana. "producto" solo si la acción es sobre un producto puntual, con el nombre EXACTO como te lo paso. "monto" es la plata en juego, tal cual te la paso; es OBLIGATORIO salvo en las acciones de tipo "datos".
- fuga: un patrón o riesgo que NO se ve en las tarjetas del email. null si no hay.
- huecos: qué dato falta y qué conclusión invalida. null si está completo.

CÓMO ELEGIR EL DOLOR
En "fugas.ranking" te paso cada fuga con la plata que representa AL AÑO. Elegí por ahí, no por lo que te parezca más grave. Y mirá "recurrente": un margen mal puesto se cobra todos los meses, mientras que la plata parada y el fiado se recuperan una sola vez. Dos fugas de monto parecido pueden diferir diez veces al año — esa es la que importa.

CÓMO ELEGIR LAS ACCIONES
- Tienen que cubrir fugas DISTINTAS. Tres acciones sobre el mismo problema es medio análisis, y el dueño no tiene cómo darse cuenta de lo que no le dijiste.
- La PRIMERA fuga del ranking lleva acción SÍ O SÍ. Un análisis cuyo problema más caro no tiene qué-hacer se descarta entero.
- Cada una dice cuánta plata recupera. "Ajustá los precios" vale la mitad que "ajustá los precios y recuperás $57.910 por mes".
- PROHIBIDO el consejo genérico. Si la recomendación le serviría igual a cualquier kiosco del país, no la escribas: no aporta nada y le hace perder la confianza en todo lo demás. Nada de "mejorá la rotación", "implementá recordatorios de pago", "controlá el stock", "hacé promociones". Cada acción tiene que apoyarse en un número concreto que te pasé.

SI TE PASO "mercado"
Es la inflación oficial del INDEC para el rubro. Sirve para lo que ningún dato interno puede: comparar cuánto subió el mercado contra cuánto remarcó el dueño. Si el rubro subió y sus precios no se movieron, ahí está la fuga y hay que decirlo.
- "periodo" es el mes AL QUE CORRESPONDE ese dato, y NO es el mes del reporte: INDEC publica con atraso. Si citás la cifra, nombrá ese mes y decí que es del INDEC. Nunca la presentes como si fuera del mes que estás analizando.

REGLAS DURAS
- Los números que te doy son la única verdad. No calcules, no estimes, no saques porcentajes ni proporciones nuevas. Si una cifra no está en los datos, no existe.
- NO SUMES montos entre sí. Decir "entre los dos son $31.350" es una cuenta tuya y descarta el análisis entero, aunque los dos sumandos sean correctos. Si querés hablar del conjunto, usá el total que ya te paso.
- NO repitas las cifras que el dueño ya ve impresas (facturado, ganancia, cantidad de ventas, variación contra el mes anterior) salvo que las estés CONECTANDO con otra para explicar una causa.
- Si hay productos sin costo cargado, no recomiendes precio sobre ellos: eso va en "huecos". Decir "acá no sé" te hace más creíble, no menos.
- Las cifras sirven para describir lo que YA pasó. No inventes topes, metas ni límites con números propios ("poné un límite de $5.000", "apuntá a 40%"): si el número no salió de los datos, la recomendación va sin número.
- Nunca nombres clientes ni personas.
- Español rioplatense, de vos. Frases cortas, una idea por oración. Sin markdown, sin negritas, sin links, sin emojis.
- Voseo sí, lunfardo NO. Nada de "al toque", "un montón", "zafar", "laburo". Profesional y cercano, no callejero.
- Los productos que te paso para remarcar NO vienen con su categoría: no supongas a cuál pertenecen. Si seis productos tienen el margen bajo, son "seis productos", no "seis cigarrillos".
- Escribí los montos con signo pesos y separador de miles ("$57.910", nunca "57910" ni "57.910 de plata"). Los porcentajes pegados al número ("12%", no "12 %").`;

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
  analisis: null,
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
   bloque <think>; otros envuelven el JSON en un bloque de código aunque se les
   diga que no. Ninguna de las dos cosas es un error del contenido: se limpian. */
function limpiar(texto: string): string {
  return texto
    .replace(/^\s*<(think|thinking|reasoning)>[\s\S]*?<\/\1>/i, "")
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();
}

/** El JSON del análisis, o null si el modelo no devolvió un objeto usable. */
function parsear(texto: string): unknown {
  try {
    return JSON.parse(texto);
  } catch {
    /* Último intento: algunos modelos anteponen una línea de cortesía pese a la
       instrucción. Si hay un objeto completo adentro, se usa ese. */
    const desde = texto.indexOf("{");
    const hasta = texto.lastIndexOf("}");
    if (desde < 0 || hasta <= desde) return null;
    try {
      return JSON.parse(texto.slice(desde, hasta + 1));
    } catch {
      return null;
    }
  }
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
    /** Datos crudos de las RPCs: sin esto el análisis solo puede repetir el email. */
    crudos?: Crudos;
    /** Inflación oficial del rubro (INDEC). Opcional: sin esto, análisis igual. */
    mercado?: Mercado | null;
    /** Interno: marca la segunda (y última) pasada. No lo usa quien llama. */
    __reintento?: boolean;
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
    return { analisis: null, estado: "desactivada", motivo: null, modelo: null, tokensIn: null, tokensOut: null };
  }
  const modelo = proveedor.modelo;

  const hechos = hechosDelReporte(reporte, opts.crudos, opts.mercado);
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
    /* `length` cubre los DOS modos de falla del mismo problema: respuesta vacía
       (todo el presupuesto se fue en razonar) y JSON cortado a la mitad (razonó
       de más y no le alcanzó para cerrar las llaves). Verificado contra
       gpt-oss-120b con el payload real: en ambos casos el reintento lo resuelve. */
    if (proveedor.nombre === "openai-compat" && r.leido && r.leido.corte === "length") {
      r = await pedirYLeer(true);
    }

    if ("http" in r) return fallo(`http_${r.http}`, modelo);
    tokensIn = r.leido.tokensIn;
    tokensOut = r.leido.tokensOut;
    corte = r.leido.corte;
    texto = r.leido.texto ? limpiar(r.leido.texto) : undefined;
  } catch (e) {
    return fallo((e as Error).message || "error_desconocido", modelo);
  } finally {
    clearTimeout(reloj);
  }

  /* Distinguir "no contestó" de "se quedó sin tokens" importa: lo segundo se
     arregla subiendo MAX_TOKENS o bajando el razonamiento, y un motivo mudo
     manda a buscar el problema al lado equivocado. */
  if (!texto) return fallo(corte === "length" || corte === "max_tokens" ? "sin_texto_por_limite" : "sin_texto", modelo);

  const crudo = parsear(texto);
  if (crudo === null) return fallo("json_invalido", modelo);

  const veredicto = verificarAnalisis(crudo as Analisis, verdadDelReporte(reporte, opts.crudos, opts.mercado));
  if (!veredicto.ok && !opts.__reintento) {
    /* Un rechazo de verificación es un mal SORTEO, no un modelo roto: el mismo
       pedido suele salir bien a la segunda (medido: Haiku pasa de ~50% a ~75%
       con un solo reintento, porque su falla típica es sumar dos cifras válidas).
       Rechazar sin reintentar deja a la mitad de los dueños sin análisis por algo
       que cuesta medio centavo arreglar. Uno solo: si vuelve a fallar, el problema
       no es la suerte. */
    return narrarMes(reporte, { ...opts, __reintento: true });
  }
  if (!veredicto.ok) {
    /* Nada a medias: un análisis con una pieza que no se pudo contrastar no se
       "corrige", se descarta. El email sale con las tarjetas deterministas, que
       siguen siendo verdad. */
    return { analisis: null, estado: "rechazada", motivo: veredicto.motivo, modelo, tokensIn, tokensOut };
  }

  return { analisis: veredicto.analisis, estado: "ok", motivo: null, modelo, tokensIn, tokensOut };
}
