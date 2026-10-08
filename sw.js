// Offline support. Network first, so players always get the latest version when
// online; the cached copy is the fallback when there's no connection.
const CACHE = 'pharaoh-chess';
const APP_FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/style.css',
  'js/engine.js', 'js/pieces-svg.js', 'js/game.js', 'js/ai.js', 'js/ai-worker.js', 'js/ui.js',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png',
  'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png'
];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

// The page's web fonts (Latin and hieroglyph subsets only, ~550 KB), read from the
// stylesheet link in index.html. Best effort: offline falls back to system fonts.
async function cacheFonts(cache) {
  try {
    const html = await (await fetch('index.html', { cache: 'reload' })).text();
    const href = /href="(https:\/\/fonts\.googleapis\.com\/[^"]+)"/.exec(html)?.[1].replace(/&amp;/g, '&');
    if (!href) return;
    const cssResponse = await fetch(href);
    const css = await cssResponse.clone().text();
    await cache.put(href, cssResponse);
    const urls = new Set();
    for (const [, subset, rule] of css.matchAll(/\/\* ([a-z-]+) \*\/\s*@font-face \{([^}]*)\}/g)) {
      const url = /url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/.exec(rule)?.[1];
      if (url && (subset === 'latin' || subset === 'egyptian-hieroglyphs')) urls.add(url);
    }
    await Promise.all([...urls].map(u => cache.add(u).catch(() => {})));
  } catch (_) {}
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(APP_FILES.map(f => new Request(f, { cache: 'reload' })));
    await cacheFonts(cache);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (err) {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    // Any page in the app (e.g. a share link) falls back to the game itself
    if (request.mode === 'navigate') return cache.match('index.html');
    throw err;
  }
}

// Fonts never change at a given URL: serve from cache, fetch once
async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin === self.location.origin) event.respondWith(networkFirst(request));
  else if (FONT_HOSTS.includes(url.hostname)) event.respondWith(cacheFirst(request));
});
