/**
 * mercado.ts — el único dato del reporte que NO calculamos nosotros.
 *
 * Trae del INDEC (vía la API de series de datos.gob.ar, pública y sin clave) la
 * inflación mensual de las divisiones que le tocan al rubro del negocio. Con eso
 * el asistente puede decir algo que ningún dato interno permite: *"tu rubro subió
 * 2,5% y vos no tocaste un precio; ahí se te fue el margen"*.
 *
 * Por qué esto SÍ y "analizar el mercado con el LLM" NO: acá el número sale de
 * una fuente oficial y se puede citar. Un modelo al que se le pregunta "¿qué se
 * vende bien en los kioscos?" no dice "no sé": inventa, y no hay con qué
 * contrastarlo. La regla es la de siempre — si no se puede verificar, no entra.
 *
 * Tres garantías:
 *   · Si la fuente no responde, no hay línea de mercado. Nunca una estimación.
 *   · El mes del dato SIEMPRE viaja con el dato: INDEC publica con atraso, así
 *     que el último disponible es de un mes ANTERIOR al del reporte. Confundirlos
 *     sería mentir sin querer.
 *   · Una llamada por rubro y por corrida, no una por negocio.
 */

const API = "https://apis.datos.gob.ar/series/api/series";
const TIMEOUT_MS = 8_000;

export type Mercado = {
  fuente: "INDEC";
  /** El mes AL QUE CORRESPONDE el dato ("mayo de 2026"), no el del reporte. */
  periodo: string;
  divisiones: { nombre: string; variacionPct: number }[];
};

type Serie = { id: string; nombre: string };

/* IDs verificados contra la API el 2026-08-05 (IPC nacional, base dic-2016,
   mensual). Si INDEC rota una serie, la llamada devuelve vacío y el reporte sale
   sin la línea de mercado — se degrada, no se rompe. */
const ALIMENTOS: Serie = { id: "146.3_IALIMENNAL_DICI_M_45", nombre: "Alimentos y bebidas" };
const TABACO: Serie = { id: "146.3_IBEBIDANAL_DICI_M_39", nombre: "Bebidas alcohólicas y tabaco" };
const BIENES: Serie = { id: "147.3_IBIENESNAL_DICI_T_19", nombre: "Bienes" };

/**
 * Qué mide el mercado de este rubro. Un kiosco vive de alimentos y cigarrillos;
 * a un rubro que no conocemos se le muestra el índice de bienes, que es lo más
 * cercano a "cosas que se venden en un mostrador" — nunca el nivel general, que
 * incluye alquileres y servicios que no tienen nada que ver.
 */
export function seriesDelRubro(vertical: string | null | undefined): Serie[] {
  switch (vertical) {
    case "kiosco":
    case "dietetica":
      return [ALIMENTOS, TABACO];
    case "petshop":
      return [ALIMENTOS, BIENES];
    default:
      return [BIENES];
  }
}

/** Cache por rubro: el cron corre una vez al mes y el dato es el mismo para todos. */
const cache = new Map<string, Mercado>();

/** Solo para los tests: el proceso del cron vive minutos, no hace falta invalidar. */
export function __limpiarCache(): void {
  cache.clear();
}

function mesLabel(fecha: string): string {
  const d = new Date(`${fecha.slice(0, 10)}T12:00:00Z`);
  const s = d.toLocaleDateString("es-AR", { month: "long", year: "numeric", timeZone: "UTC" });
  return s.replace(" de ", " de "); // "mayo de 2026"
}

export async function contextoDeMercado(
  vertical: string | null | undefined,
  opts: { fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<Mercado | null> {
  const series = seriesDelRubro(vertical);
  const clave = series.map((s) => s.id).join(",");
  const enCache = cache.get(clave);
  if (enCache) return enCache;

  const doFetch = opts.fetchImpl ?? fetch;
  const ctrl = new AbortController();
  const reloj = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? TIMEOUT_MS);
  try {
    /* `percent_change` devuelve la variación contra el mes previo ya calculada:
       una división menos que hacer de este lado es una cifra menos que puede
       salir mal. `sort=desc&limit=1` = el último mes publicado. */
    const url = `${API}?ids=${encodeURIComponent(clave)}&representation_mode=percent_change&sort=desc&limit=1&format=json`;
    const res = await doFetch(url, { signal: ctrl.signal });
    if (!res.ok) return null;

    const json = (await res.json()) as { data?: unknown[][] };
    const fila = json.data?.[0];
    if (!Array.isArray(fila) || typeof fila[0] !== "string") return null;

    const divisiones = series.map((s, i) => ({
      nombre: s.nombre,
      // La API devuelve 0.0246; el dueño lee 2,5%.
      variacionPct: Math.round(Number(fila[i + 1]) * 1000) / 10,
    }));
    // Una división sin número invalida la comparación entera: mejor sin línea.
    if (divisiones.some((d) => !Number.isFinite(d.variacionPct))) return null;

    const mercado: Mercado = { fuente: "INDEC", periodo: mesLabel(fila[0]), divisiones };
    cache.set(clave, mercado);
    return mercado;
  } catch {
    // Un fallo NO se cachea: el mes que viene se vuelve a intentar.
    return null;
  } finally {
    clearTimeout(reloj);
  }
}
