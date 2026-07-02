// StudioFlow — service worker mínimo (studioflow-v1).
// Habilita la instalabilidad (PWA) sin caché agresivo, para no servir páginas
// autenticadas/agenda desactualizadas. La red sigue siendo la fuente de verdad.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Handler de fetch real (requisito de instalabilidad de Chrome): pasa las
// navegaciones por red, sin cachear (no servimos páginas autenticadas viejas).
self.addEventListener("fetch", (event) => {
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request));
  }
});
