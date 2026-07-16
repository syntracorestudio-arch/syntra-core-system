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

// ── Web Push (029): burbuja nativa en el teléfono ──
// El servidor manda { title, body, link, tag }; al tocar la burbuja se abre la
// pantalla indicada (o se enfoca la app si ya está abierta).
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Tu estudio", body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Tu estudio", {
      body: data.body || "",
      icon: "/icon-192.png",
      // badge: monocromo sobre transparente — Android lo tiñe para la barra de
      // estado (un ícono a color termina como cuadrado blanco)
      badge: "/badge-96.png",
      // alerta perceptible: vibración y no-silenciosa (el volumen final lo
      // decide el canal de notificaciones del teléfono)
      vibrate: [200, 100, 200],
      silent: false,
      renotify: Boolean(data.tag),
      data: { link: data.link || "/app" },
      tag: data.tag || undefined,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || "/app";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(link);
          return client.focus();
        }
      }
      return self.clients.openWindow(link);
    }),
  );
});
