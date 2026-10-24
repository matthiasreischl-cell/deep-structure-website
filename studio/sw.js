/* Deep Structure Mastering Studio – Offline-Cache. Version bei jedem Update erhöhen. */
// Eigener Namensraum je Installationsort (Scope): andere Apps auf derselben Domain (z. B. das Radio) bleiben unberührt.
const PREFIX = 'ds-studio:' + self.registration.scope + ':';
const VERSION = PREFIX + 'v1.9.3';
// Ältere Studio-Versionen (bis 1.6.1) hießen 'ds-studio-v…' ohne Namensraum. Sie gehörten nur zu diesem Studio und werden aufgeräumt.
const isOwnOld = k => k !== VERSION && (k.startsWith(PREFIX) || /^ds-studio-v\d/.test(k));
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png', './favicon.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil((async () => {
  const keys = await caches.keys(), cur = await caches.open(VERSION), old = keys.filter(isOwnOld);
  // Bereits geladene Encoder (OGG, MP3) übernehmen, damit der Export nach einem Update auch offline sofort geht.
  for (const file of ['./vorbis-encoder.js', './lame.min.js']) {
    if (await cur.match(file, { ignoreSearch: true })) continue;
    for (const k of old) { const r = await (await caches.open(k)).match(file, { ignoreSearch: true }); if (r) { await cur.put(file, r); break; } }
  }
  await Promise.all(old.map(k => caches.delete(k)));
  await self.clients.claim();
})()); });
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const isFont = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (url.origin !== location.origin && !isFont) return;
  // Die App-Seite selbst: immer zuerst frisch aus dem Netz (Updates sofort), offline aus dem eigenen Cache.
  const isPage = req.mode === 'navigate' || (url.origin === location.origin && (url.pathname.endsWith('/') || url.pathname.endsWith('.html')));
  if (isPage) {
    // cache: 'no-cache' = beim Server nachfragen (304 ist billig), damit auch der HTTP-Cache von GitHub Pages keine alte Version liefert
    e.respondWith(fetch(req, { cache: 'no-cache' }).then(r => { if (r && r.ok) { const cp = r.clone(); caches.open(VERSION).then(c => c.put(req, cp)); } return r; })
      .catch(() => caches.open(VERSION).then(async c => (await c.match(req, { ignoreSearch: true })) || c.match('./index.html'))));
    return;
  }
  // Symbole, Schriften, Encoder: aus dem Cache (auch offline), im Hintergrund aktualisieren.
  e.respondWith(caches.open(VERSION).then(async c => {
    const hit = await c.match(req, { ignoreSearch: url.origin === location.origin });
    const net = fetch(req).then(r => { if (r && (r.ok || r.type === 'opaque')) c.put(req, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  }));
});
