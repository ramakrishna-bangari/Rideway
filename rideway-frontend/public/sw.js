self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  event.waitUntil(
    (async () => {
      let data = null;
      if (event.data) {
        try {
          data = event.data.json();
        } catch {
          data = { title: 'RideWay Update', message: event.data.text() };
        }
      }

      if (!data || !data.message) {
        try {
          const res = await fetch('/api/notifications');
          if (res.ok) {
            const list = await res.json();
            const notifications = Array.isArray(list) ? list : list?.content || [];
            if (notifications.length > 0) {
              const latest = notifications[0];
              data = {
                title: latest.title || 'RideWay Notification',
                message: latest.message || 'You have an update on your ride.',
                rideId: latest.rideId,
              };
            }
          }
        } catch {}
      }

      const title = data?.title || 'RideWay Notification';
      const options = {
        body: data?.message || data?.body || 'You have an update on your ride.',
        tag: data?.rideId ? `ride-${data.rideId}` : 'rideway-general',
        renotify: true,
        data: {
          url: data?.rideId ? `/rides/${data.rideId}` : (data?.url || '/activity'),
          rideId: data?.rideId,
        },
      };

      return self.registration.showNotification(title, options);
    })()
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
