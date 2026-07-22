"use client";

import { useEffect, useRef } from "react";

/**
 * Lector USB de código de barras ("keyboard wedge").
 *
 * El lector no es una cámara: se comporta como un teclado que tipea el código
 * muy rápido y cierra con Enter. Lo distinguimos de una persona escribiendo por
 * la VELOCIDAD entre teclas — un humano no tipea 12 caracteres a <35 ms cada uno.
 *
 * Escucha a nivel documento para que el cajero pueda escanear sin haber hecho
 * foco en ningún campo, que es como se trabaja en un mostrador real.
 */
export function useWedgeScanner(onScan: (code: string) => void, enabled = true) {
  const buffer = useRef("");
  const lastKeyAt = useRef(0);

  // La ref se actualiza en un efecto (no durante el render) para que el listener
  // siempre vea el último callback sin re-suscribirse en cada teclazo.
  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!enabled) return;

    const MAX_GAP_MS = 35; // entre teclas del lector
    const MIN_LENGTH = 6; // códigos más cortos son ruido

    function handler(e: KeyboardEvent) {
      // Si el foco está en un input de texto, dejamos que la persona escriba…
      const el = document.activeElement;
      const typing =
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        (el instanceof HTMLElement && el.isContentEditable);

      const now = Date.now();
      const gap = now - lastKeyAt.current;
      lastKeyAt.current = now;

      if (e.key === "Enter") {
        const code = buffer.current;
        buffer.current = "";
        if (code.length >= MIN_LENGTH) {
          // …salvo que la ráfaga venga de un lector: ahí sí lo tomamos.
          e.preventDefault();
          onScanRef.current(code);
        }
        return;
      }

      // Solo caracteres imprimibles simples (los EAN son dígitos).
      if (e.key.length !== 1) return;

      if (gap > MAX_GAP_MS) buffer.current = "";
      buffer.current += e.key;

      // Si el usuario está escribiendo a mano en un campo, no interferimos:
      // el buffer se resetea solo por el gap y nunca llega al mínimo.
      if (typing && gap > MAX_GAP_MS) buffer.current = "";
    }

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [enabled]);
}
