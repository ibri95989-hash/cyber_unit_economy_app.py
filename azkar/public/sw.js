/**
 * Service worker приложения AZKAR.
 *
 * Стратегии:
 *  • навигация — сеть с откатом в кеш (в офлайне отдаём сохранённую страницу);
 *  • статика Next (/_next/static) — cache-first, файлы иммутабельны;
 *  • шрифты и иконки — cache-first;
 *  • аудио — не кешируем агрессивно, иначе хранилище раздувается.
 *
 * Тексты азкаров попадают в кеш вместе с разметкой страниц раздела,
 * поэтому основной сценарий работает без интернета.
 */

const VERSION = 'v1';
const PRECACHE = `azkar-precache-${VERSION}`;
const RUNTIME = `azkar-runtime-${VERSION}`;

/** Страницы, которые кладём в кеш сразу при установке. */
const PRECACHE_URLS = [
  '/',
  '/azkar',
  '/morning',
  '/evening',
  '/after-prayer',
  '/sleep',
  '/protection',
  '/offline',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PRECACHE);
      // Отдельными запросами: один недоступный адрес не должен ломать всю установку.
      await Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(url)));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key !== PRECACHE && key !== RUNTIME).map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/icon.svg' ||
    /\.(?:woff2?|ttf|otf|png|jpg|jpeg|svg|webp|ico)$/.test(url.pathname)
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Аудио отдаём напрямую: диапазонные запросы и кеш плохо дружат.
  if (request.destination === 'audio' || url.pathname.startsWith('/audio/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          const cache = await caches.open(RUNTIME);
          cache.put(request, response.clone());
          return response;
        } catch {
          const cached = await caches.match(request);
          if (cached) return cached;
          const offline = await caches.match('/offline');
          if (offline) return offline;
          return new Response('Нет соединения', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          });
        }
      })(),
    );
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(PRECACHE);
          cache.put(request, response.clone());
        }
        return response;
      })(),
    );
  }
});
