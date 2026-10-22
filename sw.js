// Trabajador de servicio: deja la app lista para abrir sin internet.
// Cada versión guarda TODOS sus archivos juntos (cache cuyo nombre lleva la versión), así nunca se mezclan archivos nuevos con viejos.
// Para publicar un cambio: sube VERSION aquí. Los aparatos que ya la tienen verán el aviso «Hay una versión nueva».
const VERSION = 'asesor-v1';

const BASICOS = [
  './',
  'index.html',
  'estilos.css',
  'manifest.webmanifest',
  'js/app.js',
  'js/datos.js',
  'js/motor.js',
  'js/aprendizaje.js',
  'js/almacen.js',
  'js/ia.js',
  'js/iconos.js',
  'js/tema.js',
  'fuentes/bricolage.woff2',
  'fuentes/jetbrains-mono-500.woff2',
  'iconos/icono.svg',
  'iconos/favicon-32.png',
  'iconos/asesor-180.png',
  'iconos/asesor-192.png',
  'iconos/asesor-512.png',
  'iconos/asesor-maskable-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(BASICOS)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k.startsWith('asesor-') && k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'saltar') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Gemini y todo lo de afuera va directo a internet
  e.respondWith((async () => {
    const guardado = await caches.match(req, { ignoreSearch: req.mode === 'navigate' });
    if (guardado) return guardado;
    if (req.mode === 'navigate') {
      const inicio = await caches.match('index.html');
      if (inicio) return inicio;
    }
    return fetch(req);
  })());
});
