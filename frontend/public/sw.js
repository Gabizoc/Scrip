// Service worker Scrip : permet d'ouvrir l'app hors ligne et de préparer une capture,
// qui sera envoyée au retour du réseau (voir src/lib/offlineQueue.js).
//
// - Navigation        → réseau d'abord, sinon index.html en cache
// - /assets/* (hashés) → cache d'abord
// - Quelques GET /api nécessaires à la capture → réseau d'abord, sinon dernière réponse en cache
// - Tout le reste (POST, notes, photos, WebDAV) → réseau uniquement

const VERSION = 'v1';
const SHELL_CACHE = `scrip-shell-${VERSION}`;
const API_CACHE = 'scrip-api';
const SHELL_URLS = ['/', '/index.html', '/manifest.json', '/favicon.svg', '/icons/icon-192.png', '/icons/icon-512.png'];

const CACHED_API = [/^\/api\/auth\/status$/, /^\/api\/settings$/, /^\/api\/levels$/, /^\/api\/subjects$/];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(cache => cache.addAll(SHELL_URLS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('scrip-shell-') && k !== SHELL_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Le client demande de vider le cache API (déconnexion).
self.addEventListener('message', event => {
  if (event.data?.type === 'clear-api-cache') event.waitUntil(caches.delete(API_CACHE));
});

async function networkFirst(request, cacheName, fallbackUrl) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(fallbackUrl ?? request, response.clone());
    return response;
  } catch (err) {
    const cached = await cache.match(fallbackUrl ?? request);
    if (cached) return cached;
    throw err;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Liens magiques (/api/auth/magic/…) et WebDAV : jamais interceptés (redirections).
  if (url.pathname.startsWith('/webdav/')) return;

  if (request.mode === 'navigate') {
    if (url.pathname.startsWith('/api/')) return;
    event.respondWith(networkFirst(request, SHELL_CACHE, '/index.html'));
    return;
  }

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (url.pathname.startsWith('/api/') && CACHED_API.some(re => re.test(url.pathname))) {
    // La clé inclut la query (?levelId=…) pour /api/subjects.
    event.respondWith(networkFirst(request, API_CACHE));
  }
});
