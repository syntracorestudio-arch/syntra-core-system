/* =============================================================================
   StockFlow — Service Worker

   Dos trabajos:
   1. Hacer la app instalable (PWA) sin cachear páginas autenticadas.
   2. Recibir los push y mostrarlos como notificación del sistema.

   Sobre el caché: NO cacheamos navegaciones. Un POS que sirve una página vieja
   con precios o stock viejos es peor que un POS que no carga.
   ============================================================================= */

const VERSION = "stockflow-v1";

self.addEventListener("install", (event) => {
  // Activar de una: no queremos dos versiones del SW conviviendo en el mostrador.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

/* Navegaciones siempre por red. Sin caché de páginas privadas. */
self.addEventListener("fetch", (event) => {
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request));
  }
});

/* --------------------------------------------------------------------------
   Push: el sistema avisándole al dueño.
   -------------------------------------------------------------------------- */
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "StockFlow", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "StockFlow";
  const options = {
    body: payload.body || "",
    icon: "/icon-192.png",
    badge: "/badge-96.png",
    // Vibración + urgencia alta: si el aviso es que se te vence mercadería,
    // tiene que sonar, no quedarse mudo en la bandeja (lección StudioFlow).
    vibrate: [80, 40, 80],
    tag: payload.tag || "stockflow",
    renotify: true,
    requireInteraction: false,
    data: { url: payload.url || "/admin" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

/* Tocar la notificación abre la pantalla que corresponde (deep-link). Si la app
   ya está abierta, la enfoca en vez de abrir otra pestaña. */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/admin";

  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of all) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) await client.navigate(url);
          return;
        }
      }
      if (self.clients.openWindow) await self.clients.openWindow(url);
    })(),
  );
});
