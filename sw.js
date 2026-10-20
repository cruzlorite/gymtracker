// Service worker, only so the rest timer can show a system notification (Chrome on Android requires
// one for that). It has no fetch handler: nothing is cached and every request goes to the network.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

// Tapping the notification brings the app back to the front.
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    const client = list.find((c) => 'focus' in c);
    return client ? client.focus() : self.clients.openWindow('./');
  }));
});
