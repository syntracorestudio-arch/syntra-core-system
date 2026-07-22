/**
 * Provincias que acepta MercadoPago, con su ortografía exacta.
 *
 * Es una lista CERRADA de su API: cualquier otra cosa —"CABA", "Bs As", "Córdoba
 * Capital"— la rechaza con un 400. Por eso en el formulario va como desplegable y
 * no como texto libre: no hay forma de tipearla mal.
 *
 * Vive en su propio archivo, y no junto al resto del código de MercadoPago, porque
 * la consume un componente de cliente: importarla desde `lib/mercadopago.ts`
 * arrastraría el cliente admin de Supabase al bundle del navegador.
 */
export const PROVINCIAS_MP = [
  "Buenos Aires",
  "Capital Federal",
  "Catamarca",
  "Chaco",
  "Chubut",
  "Corrientes",
  "Córdoba",
  "Entre Ríos",
  "Formosa",
  "Jujuy",
  "La Pampa",
  "La Rioja",
  "Mendoza",
  "Misiones",
  "Neuquén",
  "Río Negro",
  "Salta",
  "San Juan",
  "San Luis",
  "Santa Cruz",
  "Santa Fe",
  "Santiago del Estero",
  "Tierra del Fuego",
  "Tucumán",
] as const;

export type DireccionNegocio = {
  calle: string;
  numero: string;
  ciudad: string;
  provincia: string;
};
