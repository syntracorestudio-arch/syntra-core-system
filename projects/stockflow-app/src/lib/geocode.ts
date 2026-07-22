import type { DireccionNegocio } from "@/lib/provincias";

/**
 * Coordenadas de la dirección del negocio, para crear su sucursal en MercadoPago.
 *
 * MP las exige y rechaza 0,0 explícitamente ("store coordinates are invalid"), así
 * que hay que resolverlas de algún lado. Usamos Nominatim (OpenStreetMap): gratis,
 * sin API key, y con una sola consulta por negocio en toda su vida — muy dentro de
 * su política de uso.
 *
 * Lo que MercadoPago usa para retenciones impositivas es la DIRECCIÓN en texto,
 * no estas coordenadas; acá alcanza con caer cerca. Por eso, si Nominatim no
 * responde o no encuentra la calle, caemos al centro de la provincia en lugar de
 * frenar el alta: nadie se queda sin poder cobrar porque OpenStreetMap esté caído.
 */

export type Coordenadas = { latitude: number; longitude: number };

/** Centros de provincia — la red de contención cuando el geocoder no resuelve. */
const CENTRO_PROVINCIA: Record<string, Coordenadas> = {
  "Buenos Aires": { latitude: -34.9215, longitude: -57.9545 },
  "Capital Federal": { latitude: -34.6037, longitude: -58.3816 },
  Catamarca: { latitude: -28.4696, longitude: -65.7852 },
  Chaco: { latitude: -27.4514, longitude: -58.9867 },
  Chubut: { latitude: -43.3002, longitude: -65.1023 },
  Corrientes: { latitude: -27.4692, longitude: -58.8306 },
  Córdoba: { latitude: -31.4201, longitude: -64.1888 },
  "Entre Ríos": { latitude: -31.7413, longitude: -60.5115 },
  Formosa: { latitude: -26.1775, longitude: -58.1781 },
  Jujuy: { latitude: -24.1858, longitude: -65.2995 },
  "La Pampa": { latitude: -36.6167, longitude: -64.2833 },
  "La Rioja": { latitude: -29.4131, longitude: -66.8558 },
  Mendoza: { latitude: -32.8895, longitude: -68.8458 },
  Misiones: { latitude: -27.3621, longitude: -55.9007 },
  Neuquén: { latitude: -38.9516, longitude: -68.0591 },
  "Río Negro": { latitude: -40.8135, longitude: -62.9967 },
  Salta: { latitude: -24.7859, longitude: -65.4117 },
  "San Juan": { latitude: -31.5375, longitude: -68.5364 },
  "San Luis": { latitude: -33.2950, longitude: -66.3356 },
  "Santa Cruz": { latitude: -51.6226, longitude: -69.2181 },
  "Santa Fe": { latitude: -31.6333, longitude: -60.7 },
  "Santiago del Estero": { latitude: -27.7951, longitude: -64.2615 },
  "Tierra del Fuego": { latitude: -54.8019, longitude: -68.303 },
  Tucumán: { latitude: -26.8083, longitude: -65.2176 },
};

export async function geocodificar(direccion: DireccionNegocio): Promise<Coordenadas> {
  const fallback = CENTRO_PROVINCIA[direccion.provincia] ?? CENTRO_PROVINCIA["Capital Federal"];

  const url =
    "https://nominatim.openstreetmap.org/search?" +
    new URLSearchParams({
      street: `${direccion.numero} ${direccion.calle}`,
      city: direccion.ciudad,
      state: direccion.provincia,
      country: "Argentina",
      format: "json",
      limit: "1",
    });

  try {
    const res = await fetch(url, {
      // Nominatim exige identificarse; sin User-Agent propio devuelve 403.
      headers: { "User-Agent": "StockFlow/1.0 (SYNTRA CORE; syntracore.studio@gmail.com)" },
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return fallback;

    const datos = (await res.json()) as { lat?: string; lon?: string }[];
    const lat = Number(datos?.[0]?.lat);
    const lon = Number(datos?.[0]?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return fallback;

    return { latitude: lat, longitude: lon };
  } catch {
    return fallback;
  }
}
