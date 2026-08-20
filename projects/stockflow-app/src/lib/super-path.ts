import "server-only";
import { timingSafeEqual } from "node:crypto";

/**
 * El segmento secreto del login de plataforma.
 *
 * POR QUÉ NO ES UNA RUTA FIJA. El panel de SYNTRA se defiende hoy con UN SOLO
 * factor: email + contraseña (el owner descartó 2FA explícitamente el
 * 2026-08-19). Con un único factor, publicar `/super/login` le regala al que
 * escanea el dato más caro que hay: que acá adentro existe un panel que ve y
 * suspende los kioscos de todos los clientes. La contraseña pasa a ser lo único
 * que separa a cualquiera de la plataforma entera.
 *
 * Una ruta fija pero "no listada" (`/syntra/entrar`) casi no mejora nada: está
 * en el repo, se adivina, y el día que alguien la escriba en un ticket queda
 * publicada para siempre.
 *
 * Este segmento viene de una variable de entorno **server-only**: no está en el
 * repo, no viaja al bundle del browser y no se puede adivinar. No es 2FA de
 * verdad —es un secreto estático, no un código que rota— pero sí es un segundo
 * "algo que sabés" independiente de la contraseña, que es exactamente lo que
 * falta cuando no hay segundo factor.
 *
 * LO QUE HACE QUE FUNCIONE: con el valor equivocado se devuelve un 404 REAL, no
 * un redirect ni un "no autorizado". Un redirect confirmaría que la familia de
 * rutas existe y convertiría la respuesta en un oráculo para adivinar el
 * segmento.
 *
 * En desarrollo, sin la variable, vale `dev`: si no, no habría forma de abrir la
 * pantalla para trabajarla. En producción la falta de variable deja el login
 * APAGADO (ninguna ruta matchea), que es el default seguro: se prefiere no poder
 * entrar a exponer una ruta con un valor por defecto conocido.
 */
export function segmentoDeAcceso(): string | null {
  const v = process.env.STOCKFLOW_SUPER_PATH?.trim();
  if (v) return v;
  return process.env.NODE_ENV === "production" ? null : "dev";
}

/**
 * Comparación en tiempo constante.
 *
 * Un `===` sobre strings corta en el primer carácter distinto, y esa diferencia
 * de tiempo es medible: permitiría adivinar el segmento carácter por carácter en
 * vez de tener que recorrer el espacio entero. Cerrarlo acá cuesta tres líneas.
 */
export function segmentoValido(recibido: string): boolean {
  const esperado = segmentoDeAcceso();
  if (!esperado) return false;

  const a = Buffer.from(recibido, "utf8");
  const b = Buffer.from(esperado, "utf8");

  /* `timingSafeEqual` lanza si los largos difieren, así que la comparación se
     hace siempre sobre buffers del mismo tamaño: se compara `b` contra sí mismo
     para gastar el mismo tiempo y devolver `false` sin filtrar la longitud. */
  if (a.length !== b.length) {
    timingSafeEqual(b, b);
    return false;
  }
  return timingSafeEqual(a, b);
}
