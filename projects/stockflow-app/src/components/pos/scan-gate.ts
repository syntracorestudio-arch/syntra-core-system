/**
 * Puerta de escaneo: decide QUÉ lectura de la cámara se acepta.
 *
 * Vive aparte del componente y sin nada del navegador a propósito: es la regla
 * que separa "cobrar una Coca" de "cobrar cuatro", y eso tiene que poder
 * probarse sin abrir una cámara (ver scan-gate.test.ts).
 *
 * Tres reglas, cada una tapando un agujero distinto:
 *
 *  1. CONFIRMACIÓN DOBLE — un código se acepta recién cuando aparece en dos
 *     ciclos SEGUIDOS. Un frame suelto puede traer el código equivocado: en el
 *     cuadro entran el EAN del producto, el de la etiqueta de góndola y el
 *     ITF-14 del pack. Además `code_39` y `code_128` no tienen dígito
 *     verificador, así que ahí el decodificador no nos protege solo.
 *
 *  2. ENFRIAMIENTO — el mismo código no se re-acepta dentro de la ventana. Con
 *     el modo continuo abierto, el producto sigue en cuadro después del beep.
 *
 *  3. TIENE QUE SALIR DEL CUADRO — además del enfriamiento, para volver a
 *     aceptar el MISMO código hace falta al menos un ciclo sin verlo. Sin esto,
 *     dejar el producto quieto frente a la cámara lo carga una vez por ventana
 *     de enfriamiento: exactamente las cuatro Cocas. Volver a escanear a
 *     propósito (alejar y acercar) genera ese hueco de forma natural, que es
 *     como se comporta cualquier lector de supermercado.
 */

export type Lectura = "aceptado" | "ignorado";

export type OpcionesPuerta = {
  /** Ventana en la que un mismo código no se repite. */
  enfriamientoMs?: number;
  /** Ciclos seguidos con el mismo código antes de aceptarlo. */
  confirmaciones?: number;
};

export class PuertaDeEscaneo {
  private readonly enfriamientoMs: number;
  private readonly confirmaciones: number;

  private candidato: string | null = null;
  private seguidas = 0;
  private ultimo: { codigo: string; ts: number } | null = null;
  /** ¿Hubo un ciclo sin ver el último código aceptado? */
  private salioDelCuadro = true;

  constructor(opciones: OpcionesPuerta = {}) {
    this.enfriamientoMs = opciones.enfriamientoMs ?? 700;
    this.confirmaciones = Math.max(1, opciones.confirmaciones ?? 2);
  }

  /**
   * Se llama en CADA ciclo de detección, haya código o no.
   * `codigo === null` significa "este ciclo no leyó nada" — y es información:
   * es lo que marca que el producto salió del cuadro.
   */
  ver(codigo: string | null, ahora: number): Lectura {
    if (codigo === null) {
      this.candidato = null;
      this.seguidas = 0;
      this.salioDelCuadro = true;
      return "ignorado";
    }

    if (codigo === this.candidato) {
      this.seguidas += 1;
    } else {
      this.candidato = codigo;
      this.seguidas = 1;
      // Ver OTRO código también significa que el anterior dejó el cuadro.
      if (this.ultimo && codigo !== this.ultimo.codigo) {
        this.salioDelCuadro = true;
      }
    }

    if (this.seguidas < this.confirmaciones) return "ignorado";

    if (this.ultimo && this.ultimo.codigo === codigo) {
      if (ahora - this.ultimo.ts < this.enfriamientoMs) return "ignorado";
      if (!this.salioDelCuadro) return "ignorado";
    }

    this.ultimo = { codigo, ts: ahora };
    this.salioDelCuadro = false;
    this.seguidas = 0; // que no vuelva a disparar con el ciclo siguiente
    return "aceptado";
  }

  /** Al abrir el escáner: nada de lo anterior cuenta. */
  reiniciar(): void {
    this.candidato = null;
    this.seguidas = 0;
    this.ultimo = null;
    this.salioDelCuadro = true;
  }
}
