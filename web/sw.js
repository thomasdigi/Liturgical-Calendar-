// Service worker: lets the app open and read saved texts without a connection.
//
//  - The app itself (page, styles, scripts, icons): network first, so a connected reader
//    always gets the latest version; the saved copy is used offline.
//  - Texts (data/…): saved as they're read, and by "Save for offline" (web/js/offline.js),
//    in the DATA cache. Served from there at once, refreshed in the background when online.
//  - Site settings (data/config.json, data/available.json): network first.
const SHELL = 'shell-v6';
const DATA = 'data-v1'; // keep in step with web/js/offline.js

const SHELL_FILES = [
  './',
  'index.html',
  'style.css',
  'i18n.js',
  'manifest.webmanifest',
  'icons/favicon-64.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'js/main.js',
  'js/util.js',
  'js/state.js',
  'js/theme.js',
  'js/data.js',
  'js/calendar.js',
  'js/controls.js',
  'js/text.js',
  'js/outline.js',
  'js/search.js',
  'js/offline.js',
  'js/settings.js',
  'js/tip.js',
  'js/lastread.js',
  'js/chant.js',
  'js/sacristan.js',
  'js/typography.js',
  'js/report.js',
  'js/wheel.js',
  'js/feasts.js',
  'js/epub.js',
  'fonts/fonts.css', // the font files themselves are saved when first used
  'vendor/exsurge.js', // chant notation (copied in by scripts/site.ts)
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((c) => c.addAll(SHELL_FILES))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== DATA).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/** Network first (with a time limit), falling back to the saved copy. */
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await Promise.race([
      fetch(request),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000)),
    ]);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const saved = await cache.match(request, { ignoreSearch: true });
    if (saved) return saved;
    throw new Error('offline and not saved');
  }
}

/** The saved copy at once if there is one (refreshed in the background), else the network. */
async function savedFirst(request, event) {
  const cache = await caches.open(DATA);
  const saved = await cache.match(request);
  const refresh = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);
  if (saved) {
    event.waitUntil(refresh);
    return saved;
  }
  const response = await refresh;
  return response ?? new Response('Not saved for offline use', { status: 504, statusText: 'Offline' });
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;
  const path = url.pathname;
  if (/\/data\/(config|available)\.json$/.test(path)) {
    event.respondWith(networkFirst(request, DATA));
  } else if (/\/data\//.test(path)) {
    event.respondWith(savedFirst(request, event));
  } else {
    // The app itself; a page address with ?date=… is the same page.
    event.respondWith(networkFirst(request, SHELL));
  }
});
