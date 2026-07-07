"use client";

import { useEffect } from "react";

/** Registra el service worker (habilita instalar la PWA). Silencioso si falla. */
export function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
