self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch {}
  event.waitUntil(
    self.registration.showNotification(data.title || 'Feedr', {
      body: data.body || '',
      icon: '/icon-192.png',
      data: { url: data.url || '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      const win = wins[0]
      if (win) {
        return win.navigate(url).then((w) => w?.focus()).catch(() => clients.openWindow(url))
      }
      return clients.openWindow(url)
    }),
  )
})
