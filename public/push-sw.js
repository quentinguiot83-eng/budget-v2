// Hors connexion : seule une page « Pas de connexion » est gardée en cache.
// Les pages et les données passent toujours par le réseau (jamais de version périmée).
const OFFLINE_CACHE = 'wimm-offline-v1';
const OFFLINE_FILES = ['/offline.html', '/favicon.svg'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(OFFLINE_CACHE).then(cache => cache.addAll(OFFLINE_FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => event.waitUntil((async () => {
  for (const key of await caches.keys()) if (key !== OFFLINE_CACHE) await caches.delete(key);
  await self.clients.claim();
})()));
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(async () =>
      (await caches.match('/offline.html')) || Response.error()));
  } else if (new URL(request.url).pathname === '/favicon.svg') {
    event.respondWith(fetch(request).catch(async () => (await caches.match('/favicon.svg')) || Response.error()));
  }
});
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { /* Always show a visible notification. */ }
  event.waitUntil(self.registration.showNotification(data.title || 'Wimm', {
    body: data.body || 'Une alerte est disponible dans Wimm.', icon: '/wimm-icon.png',
    badge: '/wimm-icon.png', tag: data.tag || 'wimm-alert', data: { url: data.url || '/' },
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const target = new URL(event.notification.data?.url || '/', self.location.origin);
    if (target.origin !== self.location.origin) return;
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).origin === target.origin) {
        await client.navigate(target.href);
        return client.focus();
      }
    }
    return self.clients.openWindow(target.href);
  })());
});
