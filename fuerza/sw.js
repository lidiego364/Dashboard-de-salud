// Service worker de Fuerza: la app funciona sin conexión en el gimnasio.
// Estrategia: los archivos de la app van primero a la red (así cada publicación
// llega al momento) y, sin conexión, se sirven desde caché. Las fuentes, desde caché.
const CACHE = 'fuerza-v2';
const SHELL = ['./', 'index.html', 'styles.css', 'version.js', 'app.js', 'programa.js', 'coach.js', 'importar.js', 'cuerpo.js', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const propio = url.origin === location.origin;
  const fuentes = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!propio && !fuentes) return;
  e.respondWith(caches.open(CACHE).then(async cache => {
    const guardar = res => { if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()); return res; };
    if (fuentes) {
      const hit = await cache.match(req);
      return hit || fetch(req).then(guardar).catch(() => Response.error());
    }
    try {
      return guardar(await fetch(req, { cache: 'no-cache' }));
    } catch (err) {
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      if (req.mode === 'navigate') return (await cache.match('index.html')) || Response.error();
      return Response.error();
    }
  }));
});
