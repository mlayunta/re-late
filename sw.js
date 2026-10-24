/* Re-Late · Service Worker
   Estrategia:
   - Documentos (HTML): network-first -> siempre llega la última versión;
     si no hay red, se sirve del caché (modo offline de la PWA).
   - Resto (CSS/JS/íconos): cache-first con revalidación en segundo plano.
   IMPORTANTE: al cambiar index.html, subir la versión de CACHE. */
const CACHE = 'relate-v3';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // no tocar externos (Google Maps, etc.)

  if (req.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname === '/') {
    // HTML: red primero, caché como respaldo offline
    e.respondWith(
      fetch(req)
        .then(res => {
          const copia = res.clone();
          caches.open(CACHE).then(c => c.put(req, copia));
          return res;
        })
        .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // Resto de recursos: caché primero
  e.respondWith(
    caches.match(req).then(cached => {
      const enRed = fetch(req).then(res => {
        const copia = res.clone();
        caches.open(CACHE).then(c => c.put(req, copia));
        return res;
      }).catch(() => cached);
      return cached || enRed;
    })
  );
});