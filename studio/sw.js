/* Deep Structure Mastering Studio – Abschalt-Service-Worker.
   Das Studio liegt nicht mehr öffentlich unter dieser Adresse (hier steht nur noch die Produktseite).
   Browser, die das Studio früher hier installiert oder geöffnet haben, laden beim nächsten Online-Besuch diese Datei:
   Sie löscht den Offline-Cache des Studios, meldet den Service Worker ab und lädt offene Fenster neu.
   Andere Caches derselben Domain (z. B. das Radio) bleiben unberührt. Bereits gespeicherte Kopien auf Geräten,
   die nie wieder online kommen, kann keine Website zurückholen. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil((async () => {
  const prefix = 'ds-studio:' + self.registration.scope + ':';
  const keys = await caches.keys();
  await Promise.all(keys.filter(k => k.startsWith(prefix) || /^ds-studio-v\d/.test(k)).map(k => caches.delete(k)));
  await self.registration.unregister();
  const wins = await self.clients.matchAll({ type: 'window' });
  wins.forEach(c => { try { c.navigate(c.url); } catch (err) {} });
})()));
