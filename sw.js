// Service Worker — cachea SOLO el shell de la app (index.html). NUNCA
// intercepta ni cachea llamadas al backend/API (Cloudflare Worker): esas las
// maneja aparte la cola de sincronizacion offline dentro de index.html.
//
// IMPORTANTE: sube este archivo a la RAIZ del mismo origen/dominio donde
// sirves la app (ej. raiz del repo en GitHub Pages), junto a index.html.
// Un Service Worker solo puede controlar paginas dentro de su mismo scope,
// y por defecto ese scope es la carpeta donde vive este archivo.
//
// Cada vez que despliegues una nueva version de index.html, sube tambien
// este archivo con CACHE_VERSION incrementado (ej. 'v2', 'v3'...). Si no lo
// haces, los usuarios que abran la app SIN conexion seguiran viendo la
// version vieja de la app indefinidamente (el cache nunca se invalida solo).
const CACHE_VERSION = 'v1';
const CACHE_NAME = 'vitilla-shell-' + CACHE_VERSION;

// Dominio del backend (Cloudflare Worker). Ajusta esto si cambias de Worker.
// Cualquier peticion a este host se deja pasar sin cachear ni interceptar.
const API_HOST = 'vitillapower.carlosjose132727.workers.dev';

const SHELL_FILES = [
  './',
  './index.html'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name.startsWith('vitilla-shell-') && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // NUNCA interceptar llamadas al backend/API: las maneja la cola de
  // sincronizacion offline dentro de la app, no este Service Worker.
  if (url.hostname === API_HOST) return;

  // Solo nos interesa el shell propio (mismo origen). Todo lo demas (CDNs de
  // terceros, imagenes externas, fuentes, etc.) se deja pasar sin cachear.
  if (url.origin !== self.location.origin) return;

  // Solo tiene sentido cachear peticiones de lectura.
  if (event.request.method !== 'GET') return;

  event.respondWith(
    (async () => {
      try {
        // network-first: si hay conexion, siempre sirve la version mas reciente
        // y refresca el cache con ella.
        const fresh = await fetch(event.request);
        const cache = await caches.open(CACHE_NAME);
        cache.put(event.request, fresh.clone());
        return fresh;
      } catch (err) {
        // Sin conexion real: usar la copia cacheada del shell.
        const cached = await caches.match(event.request);
        if (cached) return cached;
        // Ultimo recurso: servir index.html cacheado para cualquier ruta del shell
        // (util si la app usa rutas de navegador sin recargar la pagina real).
        const fallback = await caches.match('./index.html');
        if (fallback) return fallback;
        throw err;
      }
    })()
  );
});
