// Minimal service worker. It exists so NowMed can raise system-level
// notifications on phones (registration.showNotification works where
// `new Notification()` does not, e.g. Android Chrome) and so a tap on one
// brings the app to the front. No caching, so deploys are never stale.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(target).catch(() => {})
          return client.focus()
        }
      }
      return self.clients.openWindow(target)
    }),
  )
})
