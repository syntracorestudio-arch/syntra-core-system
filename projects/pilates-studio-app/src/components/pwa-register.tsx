"use client";

import { useEffect } from "react";

/** Registra el service worker (habilita instalar la PWA). Silencioso si falla. */
export function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { updateViaCache: "none" })
        // chequear updates en cada visita: sin esto un SW viejo puede seguir
        // mostrando las burbujas con ícono/vibración desactualizados
        .then((reg) => reg.update().catch(() => {}))
        .catch(() => {});
    }
  }, []);
  return null;
}
