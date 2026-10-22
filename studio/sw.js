/* Deep Structure Mastering Studio – Offline-Cache. Version bei jedem Update erhöhen. */
const VERSION = 'ds-studio-v1.3.0';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png', './favicon.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const isFont = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (url.origin !== location.origin && !isFont) return;
  // Die App-Seite selbst: immer zuerst frisch aus dem Netz (Updates sofort), offline aus dem Cache.
  const isPage = req.mode === 'navigate' || (url.origin === location.origin && (url.pathname.endsWith('/') || url.pathname.endsWith('.html')));
  if (isPage) {
    e.respondWith(fetch(req).then(r => { if (r && r.ok) { const cp = r.clone(); caches.open(VERSION).then(c => c.put(req, cp)); } return r; })
      .catch(() => caches.match(req, { ignoreSearch: true }).then(h => h || caches.match('./index.html'))));
    return;
  }
  // Symbole, Schriften: aus dem Cache (auch offline), im Hintergrund aktualisieren.
  e.respondWith(caches.open(VERSION).then(async c => {
    const hit = await c.match(req, { ignoreSearch: url.origin === location.origin });
    const net = fetch(req).then(r => { if (r && (r.ok || r.type === 'opaque')) c.put(req, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  }));
});
