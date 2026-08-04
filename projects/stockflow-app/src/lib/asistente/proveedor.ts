/**
 * proveedor.ts — de qué modelo se pide la narrativa del reporte.
 *
 * Existe para poder PROBAR la Fase 2 con un proveedor gratuito antes de decidir
 * si se paga uno. Lo que NO cambia al cambiar de proveedor: los números (los
 * calcula el composer), el verificador de cifras y el fallback determinista.
 * Un modelo más flojo no puede inventar plata — solo puede quedarse sin párrafo.
 *
 * Dos dialectos, porque son los dos que existen en la práctica:
 *   · `anthropic`      → POST /v1/messages, `x-api-key`, `system` como campo.
 *   · `openai-compat`  → POST /chat/completions, `Bearer`, `system` como mensaje.
 *     Groq habla este dialecto, y también Cerebras, OpenRouter y varios más:
 *     por eso el endpoint es una variable de entorno y no una constante.
 */

export type Proveedor = {
  nombre: "anthropic" | "openai-compat";
  /** URL COMPLETA del endpoint (no una base): lo que se le pasa a fetch. */
  url: string;
  apiKey: string;
  modelo: string;
};

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
/* Alias sin fecha: el ID con sufijo queda viejo cuando sale una versión nueva. */
const ANTHROPIC_MODELO = "claude-haiku-4-5";

/* Groq como default del dialecto abierto: su free tier NO entrena con lo que le
   mandás (a diferencia de otros gratuitos), que es lo único que lo hace elegible
   el día que haya datos de un cliente real y no un negocio de prueba. */
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODELO = "llama-3.3-70b-versatile";

const limpia = (v: string | undefined): string | null => {
  const s = (v ?? "").trim();
  return s.length > 0 ? s : null;
};

/**
 * Elige el proveedor mirando el entorno. `null` = el add-on de narrativa no está
 * configurado, que NO es un error: el reporte sale con la plantilla determinista.
 */
export function resolverProveedor(env: Record<string, string | undefined>): Proveedor | null {
  // La gratuita gana cuando están las dos: es la que se está evaluando.
  const libre = limpia(env.LLM_API_KEY);
  if (libre) {
    return {
      nombre: "openai-compat",
      url: limpia(env.LLM_BASE_URL) ?? GROQ_URL,
      apiKey: libre,
      modelo: limpia(env.LLM_MODEL) ?? GROQ_MODELO,
    };
  }

  const anthropic = limpia(env.ANTHROPIC_API_KEY);
  if (anthropic) {
    return {
      nombre: "anthropic",
      url: ANTHROPIC_URL,
      apiKey: anthropic,
      modelo: limpia(env.ANTHROPIC_MODEL) ?? ANTHROPIC_MODELO,
    };
  }

  return null;
}

export { ANTHROPIC_URL, ANTHROPIC_MODELO };
