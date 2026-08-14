/**
 * Por qué NO entrás — el texto de cada estado que puede devolver `mi_acceso()`.
 *
 * Vive acá y no dentro de `login/page.tsx` para que sea importable desde un
 * test: el bug que originó este archivo fue que `src/app/page.tsx` redirigía a
 * `/login` PELADO cuando el empleado estaba dado de baja, y ninguna suite podía
 * verlo — el SQL era correcto (`verify-identidad.sql` ya afirmaba que
 * `mi_acceso` devuelve `sin_acceso`), lo que faltaba era que alguien lo
 * consultara en ese camino. Un test verde no alcanza cuando el agujero es "esta
 * ruta no pregunta".
 *
 * REGLA DE LOS TEXTOS. La persona ACABA de tipear la clave correcta. Si el
 * mensaje no dice explícitamente que la clave no es el problema, la reintenta —
 * y a los 5 intentos el rate limit por cuenta la bloquea 15 minutos. Decir "no
 * es la clave" evita el segundo problema, que es peor que el primero.
 *
 * Y a QUIÉN mandarla depende de quién está del otro lado: al empleado lo
 * reactiva su dueño; al dueño lo destraba SYNTRA. Mandar al empleado a
 * escribirle a SYNTRA es mandarlo a una puerta donde nadie lo conoce.
 */

/** Los estados de fallo que devuelve `mi_acceso()` (migración 049). */
export const ESTADOS_SIN_ACCESO = [
  "sin_acceso",
  "sin_membresia",
  "negocio_suspendido",
] as const;

export type EstadoSinAcceso = (typeof ESTADOS_SIN_ACCESO)[number];

export const MOTIVOS: Record<EstadoSinAcceso, string> = {
  /* Membresía inactiva: el dueño lo dio de baja. Su usuario de auth sigue vivo
     —por eso llegó hasta la pantalla— y su clave es correcta. */
  sin_acceso:
    "Tu usuario está dado de baja — no es la clave. Pedile al dueño del negocio que te reactive.",
  /* El NEGOCIO está suspendido, no la persona. Antes decía "tu cuenta", que
     hacía que el empleado creyera que el problema era suyo. */
  negocio_suspendido:
    "El negocio está suspendido y no se puede operar. Si sos el dueño, escribinos y lo resolvemos; si trabajás acá, avisale a él.",
  sin_membresia:
    "Tu usuario todavía no está en ningún negocio. Pedile al dueño que te sume al equipo.",
};

/** El texto de un `?motivo=`, o null si no es un estado conocido. */
export function textoDelMotivo(motivo: string | undefined): string | null {
  if (!motivo) return null;
  return (MOTIVOS as Record<string, string>)[motivo] ?? null;
}
