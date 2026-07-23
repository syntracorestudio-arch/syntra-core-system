import qrcode from "qrcode-generator";

/**
 * Convierte la cadena EMVCo que devuelve MercadoPago en un SVG dibujable.
 *
 * Se genera en el SERVIDOR y viaja como SVG ya hecho: el navegador de la caja no
 * baja ni ejecuta un codificador de QR. En un teléfono viejo de mostrador eso es
 * la diferencia entre "aparece al toque" y "aparece".
 *
 * Corrección de errores 'M': el punto medio entre densidad y tolerancia a que la
 * pantalla esté rayada o con el brillo bajo, que es el estado real de un mostrador.
 */
export function qrSvg(data: string): string {
  const qr = qrcode(0, "M"); // typeNumber 0 = elige el tamaño mínimo que entre
  qr.addData(data, "Byte"); // EMVCo trae minúsculas y símbolos → modo Byte
  qr.make();

  // `scalable` deja el SVG sin ancho fijo para que se estire al contenedor.
  return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
}
