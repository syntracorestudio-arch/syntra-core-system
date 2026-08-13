import { randomInt } from "node:crypto";

/**
 * Generación de credenciales temporales.
 *
 * Reemplaza al generador que vivía duplicado en `super/actions.ts` y
 * `equipo/actions.ts`, que tenía dos problemas graves a la vez:
 *
 * 1. **`Math.random()`**, que no es criptográficamente seguro: su estado se
 *    puede reconstruir observando salidas. Para una contraseña eso es
 *    descalificante, no un detalle.
 * 2. **~54.000 combinaciones** (6 palabras × 9.000 números) y, como no existía
 *    forma de cambiarla dentro del producto, esa contraseña era la definitiva
 *    de cada cliente PARA SIEMPRE. Un atacante con la lista de palabras
 *    recorría el espacio entero.
 *
 * Ahora: `crypto.randomInt` (CSPRNG) sobre 64 palabras × 4 dígitos ≈ 5,8·10⁵, y
 * la credencial nace con `must_change_password = true` (migración 049), así que
 * sólo tiene que sobrevivir hasta el primer ingreso.
 *
 * Las palabras siguen siendo del mostrador y sin acentos ni ambigüedad
 * fonética: esto se DICTA por teléfono. "Kiosco guion cuatro ocho dos uno".
 */
const PALABRAS = [
  "kiosco", "gondola", "vuelto", "mostrador", "changuito", "fiambre",
  "alfajor", "gaseosa", "yerba", "azucar", "fideos", "galleta",
  "cafe", "leche", "manteca", "queso", "salame", "pan",
  "helado", "chicle", "caramelo", "turron", "budin", "factura",
  "cerveza", "vino", "soda", "jugo", "agua", "hielo",
  "escoba", "lampara", "pila", "fosforo", "servilleta", "bolsa",
  "canasta", "estante", "heladera", "balanza", "ticket", "caja",
  "moneda", "billete", "sobre", "cuaderno", "lapiz", "goma",
  "reparto", "camion", "bulto", "cajon", "pallet", "deposito",
  "verano", "invierno", "domingo", "feriado", "temprano", "tarde",
  "esquina", "barrio", "vereda", "puerta",
] as const;

/**
 * Una credencial dictable: `palabra-NNNN`.
 *
 * `randomInt` es rechazo-uniforme (no tiene el sesgo del módulo), así que las
 * 64 palabras y los 9.000 números son equiprobables de verdad.
 */
export function credencialTemporal(): string {
  const palabra = PALABRAS[randomInt(PALABRAS.length)];
  const numero = randomInt(1000, 10000);
  return `${palabra}-${numero}`;
}

/** El espacio de claves, expuesto para que un test lo pueda afirmar. */
export const ESPACIO_CREDENCIAL = PALABRAS.length * 9000;

/**
 * Normaliza el nombre de usuario de un empleado (bloque B).
 *
 * Vive acá y no en el alta porque la MISMA transformación tiene que correr al
 * crear el usuario y al hacer login: si difieren, el empleado no entra nunca y
 * el síntoma es indistinguible de una clave mal tipeada.
 */
export function normalizarUsuario(v: string): string {
  return v
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // saca acentos, deja la letra base
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function usuarioValido(v: string): boolean {
  const n = normalizarUsuario(v);
  return n.length >= 3 && n.length <= 20;
}
