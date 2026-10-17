/* Re-Late · Service Worker
   Regla de oro: cuando publiques cambios, sube la versión (v3 -> v4). */
const CACHE  = 're-late-v3';
const SHELL  = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

/* INSTALL: guardamos el "esqueleto" de la app.
   Usamos allSettled (no all) para que un 404 en un icono
   NO tumbe la instalación del Service Worker. */
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.allSettled(
      SHELL.map((url) => cache.add(new Request(url, { cache: 'reload' })))
    );
    await self.skipWaiting();
  })());
});

/* ACTIVATE: borramos caches de versiones antiguas */
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k !== CACHE ? caches.delete(k) : null)));
    await self.clients.claim();
  })());
});

/* FETCH:
   - Navegación (abrir la app): red primero, si no hay internet -> index.html en caché
   - Resto de recursos mismos origen: caché primero */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // no tocamos recursos externos

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copia = res.clone();
          caches.open(CACHE).then((c) => c.put('./index.html', copia));
          return res;
        })
        .catch(async () => (await caches.match('./index.html')) || Response.error())
    );
    return;
  }

  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res && res.status === 200) {
          const copia = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copia));
        }
        return res;
      });
    })
  );
});

/* Actualización inmediata cuando la página lo pida */
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
